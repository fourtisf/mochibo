"use client";
import { useEffect, useRef, useState } from "react";
import { SKILL_BY_ID, type Language, type SkillId, type Tone } from "@orbis/shared";
import { CloseIcon } from "@/lib/icons";
import { useRun } from "@/lib/preview/run";
import { Portrait } from "./Portrait";
import { RunOutput } from "./RunOutput";
import s from "./Discover.module.css";

export interface RunTarget {
  key: number;
  name: string;
  desc: string;
  skills: SkillId[];
  price: number;
  thumb: string;
  glow: string;
  lang: Language;
  tone: Tone;
  /** Sent to our API with the run, never shown to other people. */
  instructions: string;
  /** Example agents are priced and described by the server; without it this is your own agent. */
  exampleId?: string;
}

export function RunModal({ target, onClose }: { target: RunTarget | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { out, busy, run, reset } = useRun();
  const [skill, setSkill] = useState("");
  const [task, setTask] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d || !target) return;
    setSkill(target.skills[0] ?? "");
    setTask("");
    reset();
    if (!d.open) d.showModal();
  }, [target, reset]);

  const close = () => {
    ref.current?.close();
  };

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
              <textarea className="input" aria-label="Task" placeholder="Describe what you need" value={task} onChange={(e) => setTask(e.target.value)} />
            </div>
            <button
              className="btn btn-primary btn-block"
              disabled={busy}
              onClick={() => run({
                  skillId: skill,
                  task,
                  source: target.exampleId
                    ? { kind: "example", id: target.exampleId }
                    : { kind: "studio", persona: { name: target.name, instructions: target.instructions, tone: target.tone, lang: target.lang, skills: target.skills } },
                })}
            >
              {busy ? "Working…" : target.price ? `Run for ${target.price} CR` : "Run for free"}
            </button>
            <RunOutput out={out} style={{ maxHeight: 260 }} />
          </div>
        </>
      )}
    </dialog>
  );
}
