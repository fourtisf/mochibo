"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ECONOMICS, LIMITS, MOTIONS, SKILL_BY_ID, unlockedBetween } from "@orbis/shared";
import { RunOutput } from "@/components/RunOutput";
import { TryChips } from "@/components/TryChips";
import { PowerDock } from "@/components/PowerDock";
import { clamp } from "@/lib/format";
import { usePreview } from "@/lib/preview/store";
import { useRun } from "@/lib/preview/run";
import { useStages } from "@/lib/stages";
import { setVoiceOn, unlockSpeech, useVoiceOn } from "@/lib/talk";
import { useListener } from "@/lib/listen";
import { MicButton } from "@/components/MicButton";
import { authActions, useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { CharacterPane, GearPane, MindPane, PublishPane, SkillsPane, StylePane } from "./Panes";
import s from "./Studio.module.css";

const StudioStage = dynamic(() => import("./StudioStage"), { ssr: false });

type Tab = "char" | "style" | "gear" | "mind" | "skills" | "publish";

const ico = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, "aria-hidden": true } as const;
const TABS: [Tab, string, JSX.Element][] = [
  ["char", "Character", <svg key="i" {...ico}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>],
  ["style", "Style", <svg key="i" {...ico} strokeLinejoin="round"><path d="M8 3l4 2 4-2 5 4-3 3-2-1v12H8V9L6 10 3 7z" /></svg>],
  ["gear", "Gear", <svg key="i" {...ico} strokeLinejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></svg>],
  ["mind", "Mind", <svg key="i" {...ico} strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /><path d="M8 10h8" /></svg>],
  ["skills", "Skills", <svg key="i" {...ico} strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>],
  ["publish", "Publish", <svg key="i" {...ico}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></svg>],
];

export function Studio() {
  const { agent, saveState } = usePreview();
  const [tab, setTab] = useState<Tab>("char");
  const stages = useStages();
  const toast = useToast();
  useLevelUp();

  return (
    <section id="studio">
      <div className="wrap">
        <div className="head center">
          <h2>Build yours in under a minute.</h2>
          <p>This is the real studio. Pick a character, style it, give it skills and run a task right here.</p>
        </div>
        <div className={`win ${s.app}`}>
          <div className="win-bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span className={s.crumb}>
              <AgentSwitcher /> / <NameEdit />
              {agent.id && <span className={s.lvl} title={`Level ${agent.level}`}>Lv {agent.level}</span>}
            </span>
            <span className="bar-right">
              <span className={s.saved}>
                <i />
                <span>{saveState}</span>
              </span>
            </span>
          </div>
          <div className={s.body}>
            <div className={s.rail} role="tablist" aria-label="Studio sections">
              {TABS.map(([id, label, icon]) => (
                <button key={id} className={s.rb} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            <div className={s.side}>
              <div className={s.pane} hidden={tab !== "char"}>
                <CharacterPane />
              </div>
              <div className={s.pane} hidden={tab !== "style"}>
                <StylePane />
              </div>
              <div className={s.pane} hidden={tab !== "gear"}>
                <GearPane />
              </div>
              <div className={s.pane} hidden={tab !== "mind"}>
                <MindPane />
              </div>
              <div className={s.pane} hidden={tab !== "skills"}>
                <SkillsPane />
              </div>
              <div className={s.pane} hidden={tab !== "publish"}>
                <PublishPane active={tab === "publish"} />
              </div>
            </div>
            <div className={s.stageCol}>
              <div className={s.stage}>
                <StudioStage config={agent.cfg} />
                <div className={s.stTop}>
                  <div>
                    <div className={s.stName}>{agent.name}</div>
                    <span className={`pill ${s.stRole}`}>{agent.role || "Custom"}</span>
                  </div>
                  <div className={`${s.tools} glass`}>
                    <button className="ibtn" aria-label="Zoom in" onClick={() => zoomBy(-0.15)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                    <button className="ibtn" aria-label="Zoom out" onClick={() => zoomBy(0.15)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <VoiceToggle />
                    <button className="ibtn" aria-label="Save image" onClick={snap}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                        <circle cx="12" cy="13" r="3.5" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className={s.stBottom}>
                  <div className={`${s.motions} glass`}>
                    {MOTIONS.map(([k, n]) => (
                      <button key={k} className="chip" onClick={() => stages.get("studio")?.main?.play(k)}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <PowerDock slot="studio" className={s.dock} />
                </div>
              </div>
              <Console />
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  function zoomBy(d: number) {
    const st = stages.get("studio");
    if (st) st.zoom = clamp(st.zoom + d, 0.55, 1.3);
  }

  function snap() {
    const st = stages.get("studio");
    if (!st) return;
    const a = document.createElement("a");
    a.href = st.snapshot();
    a.download = `${agent.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
    toast("Image saved");
  }
}

/** "My agents" menu: switch between saved agents, start a new one, delete the open one. */
function AgentSwitcher() {
  const { agent, agents, openAgent, newAgent, deleteAgent } = usePreview();
  const signedIn = useAuth().status === "authenticated";
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  if (!signedIn) return <>My agents</>;
  return (
    <span className={s.switch} ref={ref}>
      <button className={s.switchBtn} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        My agents ({agents.length})
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <span className={`${s.menu} glass`} role="menu">
          {agents.map((a) => (
            <button
              key={a.id}
              role="menuitem"
              aria-current={a.id === agent.id}
              onClick={() => {
                openAgent(a.id);
                setOpen(false);
              }}
            >
              <span>{a.name}</span>
              {a.published && <i>Live</i>}
            </button>
          ))}
          <hr />
          <button
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await newAgent();
              toast("New agent created");
            }}
          >
            New agent
          </button>
          {agent.id && (
            <button
              role="menuitem"
              className={s.danger}
              onClick={async () => {
                if (!window.confirm(`Delete ${agent.name}? It leaves Discover and cannot be opened again.`)) return;
                setOpen(false);
                await deleteAgent(agent.id!).catch(() => toast("Could not delete. Try again."));
              }}
            >
              Delete this agent
            </button>
          )}
        </span>
      )}
    </span>
  );
}

/** The agent's name in the studio bar: click it (or the pencil) to rename in place. */
function NameEdit() {
  const { agent, updateAgent } = usePreview();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(agent.name);
  const done = (save: boolean) => {
    const name = draft.trim();
    if (save && name && name !== agent.name) updateAgent({ name });
    setEditing(false);
  };
  if (editing)
    return (
      <input
        className={s.nameInput}
        aria-label="Agent name"
        autoFocus
        maxLength={LIMITS.nameMax}
        value={draft}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => done(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") done(true);
          else if (e.key === "Escape") done(false);
        }}
      />
    );
  return (
    <button
      className={s.nameBtn}
      title="Rename your agent"
      aria-label={`${agent.name}, rename`}
      onClick={() => {
        setDraft(agent.name);
        setEditing(true);
      }}
    >
      <b>{agent.name}</b>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h4L19 9l-4-4L4 16z" />
        <path d="m13.5 6.5 4 4" />
      </svg>
    </button>
  );
}

/** Voice on/off for talking characters (remembered in this browser). */
function VoiceToggle() {
  const on = useVoiceOn();
  return (
    <button className="ibtn" aria-label={on ? "Mute voice" : "Turn voice on"} aria-pressed={on} title={on ? "Voice on" : "Voice off"} onClick={() => setVoiceOn(!on)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {on ? <path d="M16 9a4 4 0 0 1 0 6M18.6 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="m16.5 9.5 5 5m0-5-5 5" />}
      </svg>
    </button>
  );
}

/** Celebrate when an agent reached a higher level since this browser last saw it. */
function useLevelUp() {
  const { agent } = usePreview();
  const stages = useStages();
  const toast = useToast();
  useEffect(() => {
    if (!agent.id) return;
    const key = `mochibo-level:${agent.id}`;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(key) || 0);
      localStorage.setItem(key, String(agent.level));
    } catch {
      return;
    }
    if (!seen || agent.level <= seen) return;
    const items = unlockedBetween(seen, agent.level).map((i) => i.name);
    toast(`Level up! ${agent.name} reached level ${agent.level}${items.length ? `. Unlocked: ${items.join(", ")}` : ""}`);
    const st = stages.get("studio");
    st?.main?.play("cheer");
    st?.power("hype");
  }, [agent.id, agent.level, agent.name, stages, toast]);
}

function Console() {
  const { agent } = usePreview();
  const stages = useStages();
  const { out, turns, busy, run, reset } = useRun();
  // Credits belong to a wallet: until one is signed in, the button connects instead of running.
  const signedOut = useAuth().status === "unauthenticated";
  const [skill, setSkill] = useState<string>(agent.skills[0] ?? "");
  const [task, setTask] = useState("");
  const taskRef = useRef<HTMLTextAreaElement>(null);
  // A finished answer joins the chat: clear the box for the follow-up.
  useEffect(() => {
    if (turns.length) setTask("");
  }, [turns.length]);
  // A different agent starts a new chat.
  useEffect(() => reset(), [agent.id, reset]);

  // Keep the selected skill valid when the equipped list changes.
  useEffect(() => {
    if (!agent.skills.includes(skill as never)) setSkill(agent.skills[0] ?? "");
  }, [agent.skills, skill]);

  const go = (t = task) =>
    run({
      skillId: skill,
      task: t,
      source: { kind: "studio", persona: { name: agent.name, instructions: agent.instructions, tone: agent.tone, lang: agent.lang, skills: agent.skills } },
      stage: stages.get("studio"),
    });

  // Talk to the agent: what you say fills the task box, and the run starts when you stop talking.
  const mic = useListener({
    onText: setTask,
    onFinal: (text) => {
      stages.get("studio")?.main?.setExpression("happy", 1.2);
      void go(text);
    },
  });
  const talk = () => {
    if (signedOut) return authActions.openSignIn();
    if (mic.listening) return mic.stop();
    unlockSpeech(); // still inside the tap, so the answer can be read aloud on phones
    const actor = stages.get("studio")?.main;
    if (actor) {
      actor.play("wave");
      actor.setExpression("surprised", 0.8);
    }
    mic.start();
  };

  return (
    <div className={s.console}>
      <div className={s.conIn}>
        <select className="input" aria-label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)}>
          {agent.skills.length ? (
            agent.skills.map((id) => (
              <option key={id} value={id}>
                {SKILL_BY_ID[id].name}
              </option>
            ))
          ) : (
            <option value="">No skills</option>
          )}
        </select>
        <textarea
          ref={taskRef}
          rows={1}
          aria-label="Task"
          placeholder={mic.listening ? "Listening…" : turns.length ? "Ask a follow-up…" : "Ask your agent to do something…"}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              go();
            }
          }}
        />
        <MicButton supported={mic.supported && !signedOut} listening={mic.listening} disabled={busy} onClick={talk} />
        <button className={`btn btn-primary${signedOut ? ` ${s.connectBtn}` : ""}`} onClick={signedOut ? () => authActions.openSignIn() : () => go()} disabled={busy}>
          {busy ? "Working…" : signedOut ? "Connect wallet to run" : "Run"}
        </button>
      </div>
      <TryChips
        skillId={skill}
        onPick={(t) => {
          setTask(t);
          taskRef.current?.focus();
        }}
      />
      {mic.error && <div className="mic-note">{mic.error}</div>}
      <div className={s.conMeta}>
        <span>
          {ECONOMICS.runCostCr} CR per run{mic.supported && !signedOut ? " · tap the mic to talk" : ""}
        </span>
        <span>
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run
        </span>
      </div>
      <RunOutput out={out} turns={turns} onNewChat={reset} speaker={{ config: agent.cfg, name: agent.name }} />
    </div>
  );
}
