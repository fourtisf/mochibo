import { authActions } from "@/lib/auth";
import type { RunOutput as Out } from "@/lib/preview/run";

export function RunOutput({ out, style }: { out: Out; style?: React.CSSProperties }) {
  return (
    <div className="out" aria-live="polite" aria-busy={out.kind === "working" || (out.kind === "answer" && !out.done)} style={style}>
      {out.kind === "note" && (
        <>
          {out.text}
          {out.signIn && (
            <>
              {"\n"}
              <button className="btn btn-glass btn-sm" style={{ marginTop: 10 }} onClick={() => authActions.openSignIn()}>
                Connect wallet
              </button>
            </>
          )}
        </>
      )}
      {out.kind === "working" && <span className="note">Working on it…</span>}
      {out.kind === "answer" && (
        <>
          <span className="tag live">Live answer</span>
          {out.note && <span className="note">{"  "}{out.note}</span>}
          {"\n"}
          <span>{out.text}</span>
        </>
      )}
    </div>
  );
}
