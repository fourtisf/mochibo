/**
 * Answer-to-video: the timing script and the frame drawing for a short vertical clip (720x1280)
 * of the agent saying its answer, with captions. Pure functions, so they can be tested without a
 * browser; components/VideoMaker.tsx runs the 3D stage and the recorder.
 */
import { takeSentences } from "./talk";

export const VIDEO_W = 720;
export const VIDEO_H = 1280;
/** The 3D picture inside the frame (CSS size of the stage canvas is half of this). */
export const STAGE_W = 720;
export const STAGE_H = 900;
const STAGE_Y = 236;

export const MAX_SECONDS = 40;
const INTRO = 1.3;
const OUTRO = 2.4;
const GAP = 0.25;

export interface Segment {
  kind: "intro" | "line" | "outro";
  text: string;
  start: number;
  end: number;
}

export interface Script {
  segments: Segment[];
  total: number;
  /** True when the answer was too long for one clip and the last sentences were left out. */
  truncated: boolean;
}

/** Seconds a caption stays up: a comfortable reading pace, between 1.8 and 6 seconds. */
export const lineSeconds = (text: string) => Math.min(6, Math.max(1.8, text.split(/\s+/).filter(Boolean).length / 2.6 + 0.6));

export function buildScript(answer: string, maxSeconds = MAX_SECONDS): Script {
  const lines = takeSentences(answer, true).sentences.filter((l) => l.trim());
  const segments: Segment[] = [{ kind: "intro", text: "", start: 0, end: INTRO }];
  let t = INTRO;
  let truncated = false;
  for (const text of lines) {
    const d = lineSeconds(text);
    if (t + d + OUTRO > maxSeconds && segments.length > 1) {
      truncated = true;
      break;
    }
    segments.push({ kind: "line", text, start: t, end: t + d });
    t += d + GAP;
  }
  segments.push({ kind: "outro", text: "", start: t, end: t + OUTRO });
  return { segments, total: t + OUTRO, truncated };
}

export const segmentAt = (script: Script, t: number): Segment | null => script.segments.find((s) => t >= s.start && t < s.end) ?? null;

/** Greedy word wrap for canvas text. Long words are kept whole. */
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Clip lines to `max`, ending the last kept line with an ellipsis. */
export function clipLines(measure: (s: string) => number, lines: string[], max: number, maxWidth: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last && measure(`${last}…`) > maxWidth) last = last.replace(/\s*\S+$/, "");
  kept[max - 1] = `${last}…`;
  return kept;
}

/** The best recording format this browser offers. MP4 first: X and most phones expect it. */
export function pickFormat(isSupported: (t: string) => boolean): { mime: string; ext: "mp4" | "webm" } | null {
  for (const mime of ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"])
    if (isSupported(mime)) return { mime, ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
  return null;
}

export interface FrameInfo {
  name: string;
  question: string;
  glow: string;
  host: string;
  displayFont: string;
  uiFont: string;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw one frame: background, header, question, the 3D picture, caption and footer. */
export function drawFrame(ctx: CanvasRenderingContext2D, stage: CanvasImageSource | null, info: FrameInfo, script: Script, t: number) {
  const W = VIDEO_W;
  const H = VIDEO_H;
  const measure = (s: string) => ctx.measureText(s).width;

  // Background: the site's dark indigo with a soft glow in the agent's color behind the character.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#221a5c");
  bg.addColorStop(0.55, "#130f33");
  bg.addColorStop(1, "#0c0a1f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, STAGE_Y + STAGE_H * 0.62, 20, W / 2, STAGE_Y + STAGE_H * 0.62, 420);
  glow.addColorStop(0, `${info.glow}55`);
  glow.addColorStop(1, `${info.glow}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  if (stage) ctx.drawImage(stage, 0, STAGE_Y, STAGE_W, STAGE_H);

  // Progress
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = "#6ef0d2";
  ctx.fillRect(0, 0, W * Math.min(1, t / script.total), 6);

  // Header: agent name and the question.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f5f3ff";
  ctx.font = `700 52px ${info.displayFont}`;
  let name = info.name;
  while (name.length > 1 && measure(name) > W - 80) name = name.slice(0, -2) + "…";
  ctx.fillText(name, W / 2, 98);
  ctx.font = `500 24px ${info.uiFont}`;
  ctx.fillStyle = "#b7b1da";
  ctx.fillText("AI agent on Mochibo", W / 2, 136);

  if (info.question) {
    ctx.font = `500 26px ${info.uiFont}`;
    const q = clipLines(measure, wrapText(measure, info.question, W - 140), 2, W - 140);
    const h = 30 + q.length * 34;
    roundRect(ctx, 50, 166, W - 100, h, 22);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#b7b1da";
    q.forEach((l, i) => ctx.fillText(l, W / 2, 166 + 40 + i * 34));
  }

  // Caption: the sentence being said, or the call to action at the end.
  const seg = segmentAt(script, t);
  const outro = seg?.kind === "outro" || t >= script.total;
  const caption = outro ? `Build your own agent at ${info.host}` : seg?.kind === "line" ? seg.text : "";
  if (caption) {
    ctx.font = `600 ${outro ? 38 : 34}px ${outro ? info.displayFont : info.uiFont}`;
    const lines = clipLines(measure, wrapText(measure, caption, W - 130), 4, W - 130);
    const lh = outro ? 48 : 46;
    const boxH = 44 + lines.length * lh;
    const y = 1168 - boxH;
    roundRect(ctx, 32, y, W - 64, boxH, 28);
    ctx.fillStyle = outro ? "rgba(139,124,255,0.92)" : "rgba(23,19,58,0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 22 + lh * 0.72 + i * lh));
  }

  // Footer
  ctx.font = `600 24px ${info.uiFont}`;
  ctx.fillStyle = "#7e77a6";
  ctx.fillText(`Made with Mochibo · ${info.host}`, W / 2, 1232);
}
