"use client";
import { useEffect, useRef, useState } from "react";
import { SKILL_BY_ID, type CharacterConfig, type Language, type SkillId, type Tone } from "@orbis/shared";
import { CloseIcon } from "@/lib/icons";
import { authActions, useAuth } from "@/lib/auth";
import { useRun } from "@/lib/preview/run";
import { useListener } from "@/lib/listen";
import { MicButton } from "./MicButton";
import { Portrait } from "./Portrait";
import { RunOutput } from "./RunOutput";
import { TryChips } from "./TryChips";
import s from "./Discover.module.css";

export interface RunTarget {
  key: number;
  name: string;
  desc: string;
  skills: SkillId[];
  price: number;
  thumb: string;
  glow: string;
  /** The agent's look, for "Make video". */
  character?: CharacterConfig;
  lang: Language;
  tone: Tone;
  /** Sent to our API with the run, never shown to other people. */
  instructions: string;
  /** A published (or your own saved) agent: priced and run from its stored settings. */
  agentId?: string;
  /** Example agents are priced and described by the server. Without either id this is your studio agent. */
  exampleId?: string;
}

export function RunModal({ target, onClose }: { target: RunTarget | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { out, turns, busy, run, reset } = useRun();
  const signedOut = useAuth().status === "unauthenticated";
  const [skill, setSkill] = useState("");
  const [task, setTask] = useState("");

  useEffect(() => {
    if (turns.length) setTask("");
  }, [turns.length]);

  useEffect(() => {
    const d = ref.current;
    if (!d || !target) return;
    setSkill(target.skills[0] ?? "");
    setTask("");
    reset();
    if (!d.open) d.showModal();
  }, [target, reset]);

  const close = () => {
    mic.stop();
    ref.current?.close();
  };

  const go = (t = task) => {
    if (!target) return;
    if (signedOut) {
      // The wallet modal cannot show above an open <dialog>, so close this first.
      close();
      authActions.openSignIn();
      return;
    }
    run({
      skillId: skill,
      task: t,
      source: target.agentId
        ? { kind: "agent", id: target.agentId }
        : target.exampleId
          ? { kind: "example", id: target.exampleId }
          : { kind: "studio", persona: { name: target.name, instructions: target.instructions, tone: target.tone, lang: target.lang, skills: target.skills } },
    });
  };
  // Talk instead of typing: the run starts when you stop talking.
  const mic = useListener({ onText: setTask, onFinal: (text) => go(text) });

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {target && (
        <>
          <div className={s.mh}>
            <Portrait src={target.thumb} glow={target.glow} />
            <div>
              <h3>{target.name}</h3>
              <p>{target.desc}</p>
            </div>
            <button className="ibtn" aria-label="Close" onClick={close}>
              <CloseIcon />
            </button>
          </div>
          <div className={s.mb}>
            <div className="field">
              <div className="lbl">Skill</div>
              <select className="input" aria-label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)}>
                {target.skills.map((id) => (
                  <option key={id} value={id}>
                    {SKILL_BY_ID[id].name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="lbl">Task</div>
              <textarea className="input" aria-label="Task" placeholder={mic.listening ? "Listening…" : turns.length ? "Ask a follow-up" : "Describe what you need"} value={task} onChange={(e) => setTask(e.target.value)} />
              <TryChips skillId={skill} onPick={setTask} />
            </div>
            <div className={s.runRow}>
              <MicButton supported={mic.supported && !signedOut} listening={mic.listening} disabled={busy} onClick={() => (mic.listening ? mic.stop() : mic.start())} />
              <button className="btn btn-primary btn-block" disabled={busy} onClick={() => go()}>
                {busy ? "Working…" : signedOut ? "Connect wallet to run" : target.price ? `Run for ${target.price} CR` : "Run for free"}
              </button>
            </div>
            {mic.error && <div className="mic-note">{mic.error}</div>}
            <RunOutput out={out} turns={turns} onNewChat={reset} style={{ maxHeight: 300 }} speaker={target.character ? { config: target.character, name: target.name } : undefined} />
          </div>
        </>
      )}
    </dialog>
  );
}
