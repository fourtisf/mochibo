"use client";
/**
 * Run flow: POST /api/runs and stream the live answer (Server-Sent Events) into the output while
 * the character animates and talks. The wallet must be signed in. The API prices the run, debits
 * the credits, enforces the daily limits and refunds failed runs; the stream reports the balance.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { SKILL_BY_ID, isSkillId, type Persona, type PreviewRun } from "@orbis/shared";
import type { Actor, Stage } from "@orbis/characters";
import { refreshAccount, setBalance } from "../account";
import { API_BASE, authActions, getAuth, loadSession } from "../auth";
import { talkerFor, unlockSpeech, voiceFor } from "../talk";

export type RunOutput =
  | { kind: "empty" }
  | { kind: "note"; text: string; signIn?: boolean }
  | { kind: "working" }
  | { kind: "answer"; text: string; done: boolean; note?: string };

interface RunArgs {
  skillId: string;
  task: string;
  /** Your own agent (studio, or testing it from Discover) or an example agent priced by the server. */
  source: { kind: "studio"; persona: Persona } | { kind: "example"; id: string };
  /** Studio runs animate the character. */
  stage?: Stage | null;
}

/** The research skill answers from model knowledge unless web search is switched on for the API. */
const WEB_SEARCH = process.env.NEXT_PUBLIC_ENABLE_WEB_SEARCH === "true";
const RESEARCH_NOTE = "Web research answers from what the model knows. It does not browse the web yet.";
const SIGN_IN_NOTE = "Connect your wallet and sign in to get live answers. Signing in is free and costs no gas.";

export function useRun() {
  const [out, setOut] = useState<RunOutput>({ kind: "empty" });
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const reset = useCallback(() => {
    ctrl.current?.abort();
    setOut({ kind: "empty" });
    setBusy(false);
  }, []);

  const run = useCallback(
    async ({ skillId, task, source, stage }: RunArgs) => {
      if (!isSkillId(skillId)) return setOut({ kind: "note", text: "Equip at least one skill in the Skills tab first." });
      const skill = SKILL_BY_ID[skillId];
      if (!task.trim()) return setOut({ kind: "note", text: "Describe the task first, then run it." });
      // Still inside the click: lets mobile Safari speak the answer when it arrives.
      if (stage) unlockSpeech();
      await loadSession();
      if (getAuth().status !== "authenticated") {
        authActions.openSignIn();
        return setOut({ kind: "note", text: SIGN_IN_NOTE, signIn: true });
      }

      ctrl.current?.abort();
      const ac = (ctrl.current = new AbortController());
      setBusy(true);
      setOut({ kind: "working" });
      const actor: Actor | null = stage?.main ?? null;
      if (actor && stage) {
        actor.play("think");
        stage.power("scan");
      }
      const note = skill.id === "research" && !WEB_SEARCH ? RESEARCH_NOTE : undefined;
      // Studio runs: the character reads the answer aloud, sentence by sentence, with a speech bubble.
      const talker = actor ? talkerFor("studio") : null;
      let text = "";
      const finish = (ok: boolean) => {
        setBusy(false);
        if (talker) {
          if (ok) talker.end();
          else talker.stop();
        } else if (actor) actor.talking = false;
        if (actor && ok) actor.play("nod");
        void refreshAccount();
      };
      const fail = (message: string, signIn = false) => {
        setOut(text ? { kind: "answer", text: `${text}\n\n${message}`, done: true, note } : { kind: "note", text: message, signIn });
        finish(false);
      };

      try {
        const res = await fetch(`${API_BASE}/runs`, {
          method: "POST",
          credentials: "same-origin",
          signal: ac.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            (source.kind === "studio"
              ? { source: "studio", agent: source.persona, skillId: skill.id, task: task.trim() }
              : { source: "example", exampleId: source.id, skillId: skill.id, task: task.trim() }) satisfies PreviewRun,
          ),
        });
        if (!res.ok || !res.body) {
          const err = (await res.json().catch(() => null)) as { error?: string; message?: string; balance?: number } | null;
          if (typeof err?.balance === "number") setBalance(err.balance);
          if (res.status === 401) {
            authActions.signedOut();
            authActions.openSignIn();
            return fail(SIGN_IN_NOTE, true);
          }
          return fail(err?.message || "Live answers are not available right now. Try again in a moment.");
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf("\n\n")) >= 0) {
            const line = buf.slice(0, sep).trim();
            buf = buf.slice(sep + 2);
            if (!line.startsWith("data:")) continue;
            const ev = JSON.parse(line.slice(5)) as
              | { t: "start"; cost: number; balance: number }
              | { t: "delta"; text: string }
              | { t: "done"; balance: number }
              | { t: "error"; message: string; balance: number | null };
            if (ev.t === "start") {
              setBalance(ev.balance);
            } else if (ev.t === "delta") {
              if (!text && actor) {
                if (talker) talker.begin(actor, voiceFor(actor.config));
                else actor.talking = true;
              }
              talker?.push(ev.text);
              text += ev.text;
              setOut({ kind: "answer", text, done: false, note });
            } else if (ev.t === "done") {
              setBalance(ev.balance);
              setOut({ kind: "answer", text, done: true, note });
              return finish(true);
            } else {
              if (ev.balance !== null) setBalance(ev.balance);
              return fail(ev.message);
            }
          }
        }
        if (text) {
          setOut({ kind: "answer", text, done: true, note });
          finish(true);
        } else fail("The answer was cut off. Try again.");
      } catch {
        if (ac.signal.aborted) return finish(false);
        fail("Could not reach Mochibo. Check your connection and try again.");
      }
    },
    [],
  );

  return { out, busy, run, reset };
}
