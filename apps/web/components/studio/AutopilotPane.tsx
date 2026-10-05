"use client";
/** Studio pane: put the current agent on autopilot, manage its schedules, read its results. */
import { useEffect, useMemo, useState } from "react";
import { AUTOPILOT_EVERY, AUTOPILOT_IDEAS, ECONOMICS, LIMITS, SKILL_BY_ID, type AutopilotEvery, type AutopilotResultView } from "@orbis/shared";
import { authActions, useAuth } from "@/lib/auth";
import {
  WEEKDAYS,
  createAutopilot,
  deleteAutopilot,
  markResultsRead,
  runAutopilotNow,
  scheduleLabel,
  toUtc,
  updateAutopilot,
  useAutopilotPolling,
  useAutopilots,
  whenLabel,
} from "@/lib/autopilot";
import { copyText } from "@/lib/hooks";
import { usePreview } from "@/lib/preview/store";
import { useToast } from "@/lib/toast";
import s from "./AutopilotPane.module.css";

const SHORT: Record<AutopilotEvery, string> = { "6h": "6 hours", daily: "Daily", weekly: "Weekly" };
const STATUS_LABEL: Record<AutopilotResultView["status"], string> = { done: "Done", failed: "Refunded", skipped: "Skipped", paused: "Paused" };

function Result({ r }: { r: AutopilotResultView }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const long = r.text.length > 220;
  return (
    <li className={`${s.result} ${r.read ? "" : s.unread}`}>
      <div className={s.rHead}>
        <span className={`${s.badge} ${s[r.status]}`}>{STATUS_LABEL[r.status]}</span>
        <time dateTime={r.createdAt}>{whenLabel(r.createdAt)}</time>
      </div>
      <p className={`${s.rText} ${open || !long ? "" : s.clip}`}>{r.text}</p>
      {r.status === "done" && (
        <div className={s.rActions}>
          {long && (
            <button className="btn btn-glass btn-xs" onClick={() => setOpen((o) => !o)}>
              {open ? "Show less" : "Show all"}
            </button>
          )}
          <button
            className="btn btn-glass btn-xs"
            onClick={async () => {
              await copyText(r.text);
              toast("Copied");
            }}
          >
            Copy
          </button>
          <a className="btn btn-glass btn-xs" href={`https://x.com/intent/post?text=${encodeURIComponent(r.text.length > 270 ? `${r.text.slice(0, 267)}…` : r.text)}`} target="_blank" rel="noopener noreferrer">
            Post to X
          </a>
        </div>
      )}
    </li>
  );
}

export function AutopilotPane({ active }: { active: boolean }) {
  const { agent } = usePreview();
  const signedIn = useAuth().status === "authenticated";
  const { autopilots, results, max } = useAutopilots();
  const toast = useToast();
  useAutopilotPolling(active);

  const mine = useMemo(() => autopilots.filter((a) => a.agentId === agent.id), [autopilots, agent.id]);
  const ids = useMemo(() => new Set(mine.map((a) => a.id)), [mine]);
  const myResults = results.filter((r) => ids.has(r.autopilotId));

  // Opening the pane reads the inbox.
  useEffect(() => {
    if (active && myResults.some((r) => !r.read)) void markResultsRead();
  }, [active, myResults]);

  const [skill, setSkill] = useState<string>(agent.skills[0] ?? "");
  const [task, setTask] = useState("");
  const [every, setEvery] = useState<AutopilotEvery>("daily");
  const [time, setTime] = useState("09:00");
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  useEffect(() => {
    if (!agent.skills.includes(skill as never)) setSkill(agent.skills[0] ?? "");
  }, [agent.skills, skill]);

  if (!signedIn || !agent.id) {
    return (
      <>
        <Head />
        <p className={s.note}>Connect your wallet and sign in to put your agent on autopilot. It runs a task for you on a schedule and keeps the results here.</p>
        <button className="btn btn-primary btn-sm" onClick={() => authActions.openSignIn()}>
          Connect wallet
        </button>
      </>
    );
  }

  const ideas = AUTOPILOT_IDEAS.filter((i) => agent.skills.includes(i.skillId));
  const formOpen = showForm || mine.length === 0;
  const start = async () => {
    if (!skill) return toast("Equip a skill in the Skills tab first.");
    if (!task.trim()) return toast("Describe the task first.");
    setBusy(true);
    const { minute, weekday } = toUtc(time, every === "weekly" ? day : null);
    const err = await createAutopilot({ target: { kind: "agent", id: agent.id! }, skillId: skill as never, task: task.trim(), every, minute, weekday });
    setBusy(false);
    if (err) return toast(err);
    toast("Autopilot is on");
    setTask("");
    setShowForm(false);
  };

  return (
    <>
      <Head />
      {mine.map((a) => (
        <div key={a.id} className={`${s.card} ${a.enabled ? "" : s.off}`}>
          <div className={s.cardTop}>
            <b>{scheduleLabel(a.every, a.minute, a.weekday)}</b>
            <button
              className={s.toggle}
              role="switch"
              aria-checked={a.enabled}
              aria-label={a.enabled ? "Pause autopilot" : "Turn autopilot on"}
              onClick={async () => {
                const err = await updateAutopilot(a.id, { enabled: !a.enabled });
                if (err) toast(err);
              }}
            >
              <i />
            </button>
          </div>
          <p className={s.task}>{a.task}</p>
          <p className={s.meta}>
            {SKILL_BY_ID[a.skillId as keyof typeof SKILL_BY_ID]?.name ?? a.skillId}
            {" · "}
            {a.enabled && a.nextRunAt ? `Next run ${whenLabel(a.nextRunAt)}` : a.pausedReason ? a.pausedReason : "Paused"}
          </p>
          <div className={s.cardActions}>
            <button
              className="btn btn-glass btn-xs"
              disabled={!a.enabled}
              onClick={async () => {
                const err = await runAutopilotNow(a.id);
                toast(err ?? "Running within a minute. The result shows up below.");
              }}
            >
              Run now
            </button>
            <button
              className="btn btn-glass btn-xs"
              onClick={async () => {
                if (!window.confirm("Delete this autopilot and its results?")) return;
                const err = await deleteAutopilot(a.id);
                if (err) toast(err);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {formOpen ? (
        <div className={s.form}>
          <div className="field">
            <label className="lbl" htmlFor="apTask">
              Task <small>{task.length} / {LIMITS.instructionsMax}</small>
            </label>
            <textarea id="apTask" className="input" maxLength={LIMITS.instructionsMax} value={task} placeholder="What should your agent do on its own? Links in the task are read on every run." onChange={(e) => setTask(e.target.value)} />
            {ideas.length > 0 && (
              <div className="try-row">
                <span>Ideas</span>
                {ideas.map((i) => (
                  <button
                    key={i.task}
                    type="button"
                    className="chip try-chip"
                    title={i.task}
                    onClick={() => {
                      setTask(i.task);
                      setSkill(i.skillId);
                      setEvery(i.every);
                    }}
                  >
                    {i.task}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <div className="lbl">Skill</div>
            <select className="input" aria-label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)}>
              {agent.skills.map((id) => (
                <option key={id} value={id}>
                  {SKILL_BY_ID[id].name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="lbl">How often</div>
            <div className="seg">
              {AUTOPILOT_EVERY.map((e) => (
                <button key={e} aria-pressed={every === e} onClick={() => setEvery(e)}>
                  {SHORT[e]}
                </button>
              ))}
            </div>
          </div>
          <div className={s.when}>
            {every === "weekly" && (
              <select className="input" aria-label="Day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            <input className="input" type="time" aria-label={every === "6h" ? "First run" : "Time"} value={time} onChange={(e) => setTime(e.target.value || "09:00")} />
          </div>
          {skill === "research" && <p className={s.note}>Web research answers from what the model knows. To follow something live, put a link in the task: the page is read on every run.</p>}
          <p className={s.note}>
            Each run costs {ECONOMICS.runCostCr} CR from your balance and counts toward your daily runs. If you run out of credits, the autopilot pauses. Failed runs are refunded.
          </p>
          <div className={s.formActions}>
            <button className="btn btn-primary btn-sm" disabled={busy || autopilots.length >= max} onClick={start}>
              {busy ? "Starting…" : "Start autopilot"}
            </button>
            {mine.length > 0 && (
              <button className="btn btn-glass btn-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            )}
          </div>
          {autopilots.length >= max && <p className={s.note}>You have {max} autopilots, the most per wallet. Delete one to add another.</p>}
        </div>
      ) : (
        <button className="btn btn-glass btn-sm" disabled={autopilots.length >= max} onClick={() => setShowForm(true)}>
          Add another schedule
        </button>
      )}

      <div className={s.inboxHead}>Results</div>
      {myResults.length ? (
        <ul className={s.results}>
          {myResults.map((r) => (
            <Result key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        <p className={s.note}>{mine.length ? "Results show up here after each run." : "No results yet."}</p>
      )}
    </>
  );
}

function Head() {
  return (
    <>
      <div className={s.paneH}>Autopilot</div>
      <div className={s.paneS}>Your agent works on its own schedule. Results land here.</div>
    </>
  );
}
