"use client";
import { useEffect, useRef, useState } from "react";
import { authActions } from "@/lib/auth";
import { copyText } from "@/lib/hooks";
import { StarIcon } from "@/lib/icons";
import { rateRun, type RunOutput as Out, type Turn } from "@/lib/preview/run";
import { useToast } from "@/lib/toast";

/** One-tap rating for a finished run of a published agent. */
function Stars({ runId }: { runId: string }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [msg, setMsg] = useState("");
  if (msg) return <span className="run-rated">{msg}</span>;
  return (
    <span className="run-stars" onMouseLeave={() => setHover(0)} aria-label="Rate this answer">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={(hover || stars) >= n ? "on" : ""}
          onMouseEnter={() => setHover(n)}
          onClick={async () => {
            setStars(n);
            const err = await rateRun(runId, n);
            setMsg(err ?? "Thanks for rating");
          }}
        >
          <StarIcon />
        </button>
      ))}
    </span>
  );
}

function Actions({ text, runId, rateable }: { text: string; runId?: string; rateable?: boolean }) {
  const toast = useToast();
  return (
    <span className="run-actions">
      <button
        type="button"
        className="btn btn-glass btn-xs"
        onClick={async () => {
          await copyText(text);
          toast("Copied");
        }}
      >
        Copy
      </button>
      <a className="btn btn-glass btn-xs" href={`https://x.com/intent/post?text=${encodeURIComponent(text.length > 270 ? `${text.slice(0, 267)}…` : text)}`} target="_blank" rel="noopener noreferrer">
        Post to X
      </a>
      {rateable && runId && <Stars runId={runId} />}
    </span>
  );
}

/** The run output as a short chat: earlier turns, then the current answer with its actions. */
export function RunOutput({ out, turns = [], onNewChat, style }: { out: Out; turns?: Turn[]; onNewChat?: () => void; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const current = out.kind === "answer" ? out.text : out.kind;
  // Keep the newest text in view while it streams.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [current, turns.length]);

  const earlier = out.kind === "answer" && out.done && turns.length && turns[turns.length - 1].task === out.task ? turns.slice(0, -1) : turns;
  const empty = out.kind === "empty" && !turns.length;
  return (
    <div ref={ref} className="out" aria-live="polite" aria-busy={out.kind === "working" || (out.kind === "answer" && !out.done)} style={style} hidden={empty}>
      {earlier.map((t, i) => (
        <div className="turn past" key={i}>
          <div className="you">{t.task}</div>
          <div>{t.answer}</div>
        </div>
      ))}
      {out.kind === "note" && (
        <div className="turn">
          {out.text}
          {out.signIn && (
            <div>
              <button className="btn btn-glass btn-sm" style={{ marginTop: 10 }} onClick={() => authActions.openSignIn()}>
                Connect wallet
              </button>
            </div>
          )}
        </div>
      )}
      {out.kind === "working" && <span className="note">{out.text || "Working on it…"}</span>}
      {out.kind === "answer" && (
        <div className="turn">
          <div className="you">{out.task}</div>
          <span className="tag live">Live answer</span>
          {out.note && <span className="note">{"  "}{out.note}</span>}
          <div className="answer">{out.text}</div>
          {out.done && <Actions text={out.text} runId={out.runId} rateable={out.rateable} />}
        </div>
      )}
      {onNewChat && turns.length > 0 && out.kind !== "working" && !(out.kind === "answer" && !out.done) && (
        <div className="run-foot">
          <span>Ask a follow-up, or</span>
          <button type="button" className="btn btn-glass btn-xs" onClick={onNewChat}>
            New chat
          </button>
        </div>
      )}
    </div>
  );
}
