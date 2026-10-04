"use client";
/**
 * Run flow: POST /api/runs and stream the live answer (Server-Sent Events) into the output while
 * the character animates and talks. The wallet must be signed in. The API prices the run, debits
 * the credits, enforces the daily limits and refunds failed runs; the stream reports the balance.
 *
 * Runs are a chat: each finished answer is kept as a turn, and the last turns go with the next run
 * so follow-ups ("make it shorter") work. "New chat" clears them.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { SKILL_BY_ID, isSkillId, type Persona, type PreviewRun } from "@orbis/shared";
import type { Actor, Stage } from "@orbis/characters";
import { refreshAccount, setBalance } from "../account";
import { API_BASE, api, authActions, getAuth, loadSession } from "../auth";
import { talkerFor, unlockSpeech, voiceFor } from "../talk";

export interface Turn {
  task: string;
  answer: string;
  /** Set for runs of published agents: the runner can rate them once. */
  runId?: string;
  rateable?: boolean;
}

export type RunOutput =
  | { kind: "empty" }
  | { kind: "note"; text: string; signIn?: boolean }
  | { kind: "working"; text?: string }
  | { kind: "answer"; task: string; text: string; done: boolean; note?: string; runId?: string; rateable?: boolean };

export type RunSource = { kind: "studio"; persona: Persona } | { kind: "agent"; id: string } | { kind: "example"; id: string };

interface RunArgs {
  skillId: string;
  task: string;
  /** Your own agent in the studio, a saved agent (published, or yours), or an example agent. */
  source: RunSource;
  /** Studio runs animate the character. */
  stage?: Stage | null;
}

const RESEARCH_NOTE = "Web research answers from what the model knows. It does not browse the web yet.";
const SIGN_IN_NOTE = "Connect your wallet and sign in to get live answers. Signing in is free and costs no gas.";
const MAX_HISTORY = 3;

// Whether the API gives the research skill web search (asked once per page).
let webSearch: Promise<boolean> | null = null;
const hasWebSearch = () =>
  (webSearch ??= api<{ webSearch?: boolean }>("/runs/status")
    .then((r) => Boolean(r.webSearch))
    .catch(() => false));

export function useRun() {
  const [out, setOut] = useState<RunOutput>({ kind: "empty" });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  useEffect(() => () => ctrl.current?.abort(), []);

  /** Clear the output and the chat (new target, or "New chat"). */
  const reset = useCallback(() => {
    ctrl.current?.abort();
    setOut({ kind: "empty" });
    setTurns([]);
    setBusy(false);
  }, []);

  const run = useCallback(async ({ skillId, task, source, stage }: RunArgs) => {
    if (!isSkillId(skillId)) return setOut({ kind: "note", text: "Equip at least one skill in the Skills tab first." });
    const skill = SKILL_BY_ID[skillId];
    const ask = task.trim();
    if (!ask) return setOut({ kind: "note", text: "Describe the task first, then run it." });
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
    const note = skill.id === "research" && !(await hasWebSearch()) ? RESEARCH_NOTE : undefined;
    // Studio runs: the character reads the answer aloud, sentence by sentence, with a speech bubble.
    const talker = actor ? talkerFor("studio") : null;
    const history = turnsRef.current.slice(-MAX_HISTORY).map((t) => ({ task: t.task, answer: t.answer.slice(0, 6000) }));
    let text = "";
    let runId: string | undefined;
    let rateable = false;
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
      setOut(text ? { kind: "answer", task: ask, text: `${text}\n\n${message}`, done: true, note } : { kind: "note", text: message, signIn });
      finish(false);
    };
    const succeed = () => {
      setOut({ kind: "answer", task: ask, text, done: true, note, runId, rateable });
      setTurns((t) => [...t, { task: ask, answer: text, runId, rateable }].slice(-10));
      finish(true);
    };

    const base = { skillId: skill.id, task: ask, history };
    const body: PreviewRun =
      source.kind === "studio"
        ? { source: "studio", agent: source.persona, ...base }
        : source.kind === "agent"
          ? { source: "agent", agentId: source.id, ...base }
          : { source: "example", exampleId: source.id, ...base };

    try {
      const res = await fetch(`${API_BASE}/runs`, {
        method: "POST",
        credentials: "same-origin",
        signal: ac.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
            | { t: "start"; runId: string; cost: number; balance: number; rateable?: boolean }
            | { t: "status"; text: string }
            | { t: "delta"; text: string }
            | { t: "done"; balance: number }
            | { t: "error"; message: string; balance: number | null };
          if (ev.t === "start") {
            setBalance(ev.balance);
            runId = ev.runId;
            rateable = Boolean(ev.rateable);
          } else if (ev.t === "status") {
            setOut({ kind: "working", text: ev.text });
          } else if (ev.t === "delta") {
            if (!text && actor) {
              if (talker) talker.begin(actor, voiceFor(actor.config));
              else actor.talking = true;
            }
            talker?.push(ev.text);
            text += ev.text;
            setOut({ kind: "answer", task: ask, text, done: false, note });
          } else if (ev.t === "done") {
            setBalance(ev.balance);
            return succeed();
          } else {
            if (ev.balance !== null) setBalance(ev.balance);
            return fail(ev.message);
          }
        }
      }
      if (text) succeed();
      else fail("The answer was cut off. Try again.");
    } catch {
      if (ac.signal.aborted) return finish(false);
      fail("Could not reach Mochibo. Check your connection and try again.");
    }
  }, []);

  return { out, turns, busy, run, reset };
}

/** Rate a finished run of a published agent (1 to 5). Returns an error message or null. */
export async function rateRun(runId: string, stars: number): Promise<string | null> {
  try {
    await api(`/runs/${runId}/rating`, { method: "POST", body: JSON.stringify({ stars }) });
    return null;
  } catch {
    return "Could not save the rating.";
  }
}
