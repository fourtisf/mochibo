"use client";
/**
 * Run flow: POST /api/runs and stream the live answer (Server-Sent Events) into the output while
 * the character animates. The wallet must be signed in; the API enforces the daily limits.
 * Preview credits are still the in-browser balance (store.tsx) until the ledger exists in phase 3:
 * they are debited only after the API accepts the run and refunded if the run fails.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { SKILL_BY_ID, isSkillId, type PreviewRun } from "@orbis/shared";
import type { Actor, Stage } from "@orbis/characters";
import { API_BASE, authActions, getAuth, loadSession } from "../auth";
import { fmt } from "../format";
import { usePreview } from "./store";

export type RunOutput =
  | { kind: "empty" }
  | { kind: "note"; text: string; signIn?: boolean }
  | { kind: "working" }
  | { kind: "answer"; text: string; done: boolean; note?: string };

interface RunArgs {
  skillId: string;
  task: string;
  persona: PreviewRun["agent"];
  cost: number;
  label?: string;
  /** Studio runs animate the character. */
  stage?: Stage | null;
}

/** The research skill answers from model knowledge unless web search is switched on for the API. */
const WEB_SEARCH = process.env.NEXT_PUBLIC_ENABLE_WEB_SEARCH === "true";
const RESEARCH_NOTE = "Web research answers from what the model knows. It does not browse the web yet.";
const SIGN_IN_NOTE = "Connect your wallet and sign in to get live answers. Signing in is free and costs no gas.";

export function useRun() {
  const { credits, spend, refund } = usePreview();
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
    async ({ skillId, task, persona, cost, label, stage }: RunArgs) => {
      if (!isSkillId(skillId)) return setOut({ kind: "note", text: "Equip at least one skill in the Skills tab first." });
      const skill = SKILL_BY_ID[skillId];
      if (!task.trim()) return setOut({ kind: "note", text: "Describe the task first, then run it." });
      if (credits < cost) {
        return setOut({ kind: "note", text: `Not enough credits. This run costs ${cost} CR and you have ${fmt(credits)} CR. Add preview credits from the balance at the top.` });
      }
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
      let charged = false;
      let text = "";
      const finish = (ok: boolean) => {
        setBusy(false);
        if (actor) {
          actor.talking = false;
          if (ok) actor.play("cheer");
        }
      };
      const fail = (message: string, signIn = false) => {
        if (charged) refund(cost, `Refund: ${label || persona.name} (${skill.name})`);
        setOut(text ? { kind: "answer", text: `${text}\n\n${message}`, done: true, note } : { kind: "note", text: message, signIn });
        finish(false);
      };

      try {
        const res = await fetch(`${API_BASE}/runs`, {
          method: "POST",
          credentials: "same-origin",
          signal: ac.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent: persona, skillId: skill.id, task: task.trim() } satisfies PreviewRun),
        });
        if (!res.ok || !res.body) {
          const err = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
          if (res.status === 401) {
            authActions.signedOut();
            authActions.openSignIn();
            return fail(SIGN_IN_NOTE, true);
          }
          return fail(err?.message || "Live answers are not available right now. Try again in a moment.");
        }
        charged = spend(cost, `Ran ${label || persona.name} (${skill.name})`) && cost > 0;

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
            const ev = JSON.parse(line.slice(5)) as { t: "delta"; text: string } | { t: "done" } | { t: "error"; message: string };
            if (ev.t === "delta") {
              if (!text && actor) actor.talking = true;
              text += ev.text;
              setOut({ kind: "answer", text, done: false, note });
            } else if (ev.t === "done") {
              setOut({ kind: "answer", text, done: true, note });
              return finish(true);
            } else {
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
    [credits, spend, refund],
  );

  return { out, busy, run, reset };
}
