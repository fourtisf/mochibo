import type { RunOutput as Out } from "@/lib/preview/run";

export function RunOutput({ out, style }: { out: Out; style?: React.CSSProperties }) {
  return (
    <div className="out" aria-live="polite" style={style}>
      {out.kind === "note" && out.text}
      {out.kind === "working" && <span className="note">Working on it…</span>}
      {out.kind === "answer" && (
        <>
          <span className={`tag${out.live ? " live" : ""}`}>{out.live ? "Live answer" : "Sample answer. Connect an AI provider for live answers."}</span>
          {"\n"}
          <span>{out.text}</span>
        </>
      )}
    </div>
  );
}
