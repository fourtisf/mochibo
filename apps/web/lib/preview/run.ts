"use client";
/**
 * PREVIEW run flow (phase 1). Mirrors runSkill() in the prototype: check skill, task and
 * balance, debit, animate the actor, then type out a clearly labelled sample answer.
 * Phase 3: replace the body with POST /runs and read the SSE stream into the same callbacks.
 */
import { useCallback, useRef, useState } from "react";
import { SKILL_BY_ID, isSkillId, type Language } from "@orbis/shared";
import type { Actor, Stage } from "@orbis/characters";
import { fmt } from "../format";
import { isReducedMotion } from "../hooks";
import { sampleAnswer } from "./sample";
import { usePreview } from "./store";

export type RunOutput =
  | { kind: "empty" }
  | { kind: "note"; text: string }
  | { kind: "working" }
  | { kind: "answer"; live: boolean; text: string };

interface RunArgs {
  skillId: string;
  task: string;
  persona: { name: string; lang: Language };
  cost: number;
  label?: string;
  /** Studio runs animate the character. */
  stage?: Stage | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useRun() {
  const { credits, spend } = usePreview();
  const [out, setOut] = useState<RunOutput>({ kind: "empty" });
  const [busy, setBusy] = useState(false);
  const raf = useRef(0);

  const reset = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setOut({ kind: "empty" });
    setBusy(false);
  }, []);

  const run = useCallback(
    async ({ skillId, task, persona, cost, label, stage }: RunArgs) => {
      if (!isSkillId(skillId)) return setOut({ kind: "note", text: "Equip at least one skill in the Skills tab first." });
      const skill = SKILL_BY_ID[skillId];
      if (!task.trim()) return setOut({ kind: "note", text: "Describe the task first, then run it." });
      if (!spend(cost, `Ran ${label || persona.name} (${skill.name})`)) {
        return setOut({
          kind: "note",
          text: `Not enough credits. This run costs ${cost} CR and you have ${fmt(credits)} CR. Add preview credits from the balance at the top.`,
        });
      }
      setBusy(true);
      setOut({ kind: "working" });
      const actor: Actor | null = stage?.main ?? null;
      if (actor && stage) {
        actor.play("think");
        stage.power("scan");
      }
      await sleep(1200);
      const txt = sampleAnswer(skill.id, task, persona.lang);
      const live = false;
      setBusy(false);
      if (actor) actor.talking = true;
      const done = () => {
        if (actor) {
          actor.talking = false;
          actor.play(live ? "cheer" : "nod");
        }
      };
      if (isReducedMotion()) {
        setOut({ kind: "answer", live, text: txt });
        done();
        return;
      }
      let i = 0;
      const step = () => {
        i = Math.min(txt.length, i + 3);
        setOut({ kind: "answer", live, text: txt.slice(0, i) });
        if (i < txt.length) raf.current = requestAnimationFrame(step);
        else done();
      };
      step();
    },
    [credits, spend],
  );

  return { out, busy, run, reset };
}
