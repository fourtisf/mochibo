"use client";
/**
 * Turns an answer into a short vertical video (720x1280) of the agent saying it, with captions.
 * Everything happens in the visitor's browser: a 3D stage renders the character, each frame is
 * drawn onto a 2D canvas with the captions, and MediaRecorder records that canvas. The clip is
 * silent (browsers cannot record their own speech voice); captions carry the words.
 */
import { useEffect, useRef, useState } from "react";
import type { CharacterConfig, MotionName } from "@orbis/shared";
import type { Actor, Stage } from "@orbis/characters";
import { loadEngine } from "@/lib/engine";
import { appBaseUrl } from "@/lib/env";
import { CloseIcon } from "@/lib/icons";
import { STAGE_H, STAGE_W, VIDEO_H, VIDEO_W, buildScript, drawFrame, pickFormat, segmentAt, type FrameInfo, type Script } from "@/lib/video";
import s from "./VideoMaker.module.css";

export interface VideoJob {
  key: number;
  config: CharacterConfig;
  name: string;
  question: string;
  answer: string;
}

type State = { kind: "preparing" } | { kind: "recording"; pct: number } | { kind: "ready"; url: string; file: File } | { kind: "error"; message: string };

const GESTURES: MotionName[] = ["point", "nod", "shrug", "nod"];
const fileName = (name: string, ext: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent"}-mochibo.${ext}`;

export function VideoMaker({ job, onClose }: { job: VideoJob | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const out = useRef<HTMLCanvasElement>(null);
  const three = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<State>({ kind: "preparing" });

  useEffect(() => {
    const d = ref.current;
    if (!d || !job) return;
    if (!d.open) d.showModal();
    setState({ kind: "preparing" });

    let stage: Stage | null = null;
    let rec: MediaRecorder | null = null;
    let url = "";
    let cancelled = false;

    (async () => {
      const format = typeof MediaRecorder !== "undefined" ? pickFormat((t) => MediaRecorder.isTypeSupported(t)) : null;
      const ctx = out.current?.getContext("2d");
      if (!format || !ctx || !out.current?.captureStream) return setState({ kind: "error", message: "This browser cannot record video. Try Chrome, Edge or Safari." });
      const engine = await loadEngine();
      if (cancelled) return;
      if (!engine.hasWebGL()) return setState({ kind: "error", message: "This device cannot show the 3D character, so it cannot make a video." });
      await document.fonts?.ready;
      if (cancelled || !three.current) return;

      const css = getComputedStyle(document.body);
      const info: FrameInfo = {
        name: job.name,
        question: job.question,
        glow: job.config.glow,
        host: (appBaseUrl() || location.origin).replace(/^https?:\/\//, ""),
        displayFont: css.getPropertyValue("--display").trim() || "system-ui, sans-serif",
        uiFont: css.getPropertyValue("--sans").trim() || "system-ui, sans-serif",
      };
      const script: Script = buildScript(job.answer);
      let actor: Actor | null = null;
      let t0 = 0;
      let lastSeg = -1;
      let lines = 0;

      const frame = (st: Stage) => {
        if (cancelled) return;
        if (!t0) {
          // First frame: start the recorder now that the stage has a picture.
          t0 = performance.now();
          const stream = out.current!.captureStream(30);
          rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 5_000_000 });
          const chunks: Blob[] = [];
          rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          rec.onstop = () => {
            if (cancelled) return;
            const type = format.mime.split(";")[0];
            const file = new File(chunks, fileName(job.name, format.ext), { type });
            url = URL.createObjectURL(file);
            setState({ kind: "ready", url, file });
          };
          rec.start(1000);
        }
        const t = (performance.now() - t0) / 1000;
        const seg = segmentAt(script, t);
        const i = seg ? script.segments.indexOf(seg) : -1;
        if (actor && i !== lastSeg) {
          lastSeg = i;
          if (seg?.kind === "intro") actor.play("wave");
          else if (seg?.kind === "line") {
            actor.talking = true;
            if (lines++ % 3 === 1 && !actor.isPlaying) actor.play(GESTURES[(lines >> 1) % GESTURES.length]);
          } else if (seg?.kind === "outro") {
            actor.talking = false;
            actor.play("cheer");
          } else actor.talking = false; // short pause between sentences
        }
        drawFrame(ctx, st.canvas, info, script, t);
        const pct = Math.min(100, Math.round((t / script.total) * 100));
        setState((cur) => (cur.kind === "ready" || (cur.kind === "recording" && cur.pct === pct) ? cur : { kind: "recording", pct }));
        if (t >= script.total + 0.15 && rec?.state === "recording") rec.stop();
      };

      stage = engine.createStage(three.current, { halfW: 0.95, halfH: 1.32, camY: 1.02, lookY: 0.8, pixelRatio: 2, pauseOffscreen: false, trackPointer: false, onFrame: frame });
      actor = stage.addActor(job.config, { rot: 0.1, main: true });
    })().catch(() => !cancelled && setState({ kind: "error", message: "Could not make the video. Try again." }));

    return () => {
      cancelled = true;
      if (rec && rec.state !== "inactive") rec.stop();
      stage?.dispose();
      if (url) URL.revokeObjectURL(url);
    };
  }, [job]);

  const close = () => ref.current?.close();
  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file], title: `${job?.name} on Mochibo` });
    } catch {
      /* cancelled */
    }
  };
  const canShare = (file: File) => typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  return (
    <dialog ref={ref} className={s.dlg} onClose={onClose} onClick={(e) => e.target === e.currentTarget && close()}>
      {job && (
        <div className={s.wrap}>
          <div className={s.head}>
            <h3>Answer as video</h3>
            <button className="ibtn" aria-label="Close" onClick={close}>
              <CloseIcon />
            </button>
          </div>
          <div className={s.frame}>
            <canvas ref={three} className={s.three} style={{ width: STAGE_W / 2, height: STAGE_H / 2 }} aria-hidden="true" />
            {state.kind === "ready" ? (
              <video className={s.preview} src={state.url} controls playsInline loop autoPlay muted />
            ) : (
              <canvas ref={out} className={s.preview} width={VIDEO_W} height={VIDEO_H} aria-label="Video preview" />
            )}
          </div>
          {state.kind === "preparing" && <p className={s.note}>Getting your agent ready…</p>}
          {state.kind === "recording" && (
            <>
              <div className={s.bar}>
                <i style={{ width: `${state.pct}%` }} />
              </div>
              <p className={s.note}>Recording… {state.pct}%. Keep this tab open.</p>
            </>
          )}
          {state.kind === "error" && <p className={s.note}>{state.message}</p>}
          {state.kind === "ready" && (
            <>
              <div className={s.actions}>
                <a className="btn btn-primary btn-sm" href={state.url} download={state.file.name}>
                  Download video
                </a>
                {canShare(state.file) && (
                  <button className="btn btn-glass btn-sm" onClick={() => share(state.file)}>
                    Share
                  </button>
                )}
              </div>
              <p className={s.note}>
                {state.file.name.endsWith(".webm")
                  ? "Saved as WebM, which TikTok and YouTube accept. X needs MP4: Chrome 126 or newer and Safari record MP4."
                  : "Attach it to your post on X or TikTok. The clip has captions and no sound."}
              </p>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
