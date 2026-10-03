/* TEXTURES (prototype section). Shared canvas textures are cached in TEX and never disposed. */
import * as THREE from "three";

/** Shared texture cache: glow, shadow, blush, floor, eye<color>, emb<color>. Never dispose these. */
export const TEX: Record<string, THREE.CanvasTexture> = {};

/** True when `t` lives in the shared cache. */
export function isSharedTexture(t: THREE.Texture | null | undefined): boolean {
  if (!t) return false;
  for (const k in TEX) if (TEX[k] === t) return true;
  return false;
}

export type Draw2D = (x: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTex(w: number, h: number, draw: Draw2D): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d") as CanvasRenderingContext2D, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}

const radialTex = (key: string, stops: [number, string][]): THREE.CanvasTexture =>
  TEX[key] ||
  (TEX[key] = canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }));

export const glowTex = () => radialTex("glow", [[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,.55)"], [1, "rgba(255,255,255,0)"]]);
export const shadowTex = () => radialTex("shadow", [[0, "rgba(6,3,20,.85)"], [0.55, "rgba(6,3,20,.35)"], [1, "rgba(6,3,20,0)"]]);
export const blushTex = () => radialTex("blush", [[0, "rgba(255,110,150,.75)"], [1, "rgba(255,110,150,0)"]]);
export const floorTex = () => radialTex("floor", [[0, "rgba(150,130,255,.32)"], [0.5, "rgba(110,90,230,.1)"], [1, "rgba(110,90,230,0)"]]);

export function eyeTex(col: string): THREE.CanvasTexture {
  const k = "eye" + col;
  if (TEX[k]) return TEX[k];
  return (TEX[k] = canvasTex(256, 256, (x) => {
    const c = new THREE.Color(col),
      light = "#" + c.clone().lerp(new THREE.Color("#ffffff"), 0.5).getHexString();
    x.fillStyle = "#1A1035"; x.beginPath(); x.arc(128, 128, 127, 0, 7); x.fill();
    const g = x.createRadialGradient(128, 160, 6, 128, 140, 112); g.addColorStop(0, light); g.addColorStop(0.55, col); g.addColorStop(1, "#1A1035");
    x.fillStyle = g; x.beginPath(); x.arc(128, 142, 110, 0, 7); x.fill();
    x.fillStyle = "#0C0720"; x.beginPath(); x.arc(128, 138, 50, 0, 7); x.fill();
    x.fillStyle = "rgba(255,255,255,.2)"; x.beginPath(); x.ellipse(128, 210, 64, 22, 0, 0, 7); x.fill();
    x.fillStyle = "#fff"; x.beginPath(); x.ellipse(172, 84, 32, 25, -0.45, 0, 7); x.fill();
    x.beginPath(); x.arc(90, 180, 13, 0, 7); x.fill();
    x.beginPath(); x.arc(150, 130, 7, 0, 7); x.fill();
  }));
}

export function emblemTex(col: string): THREE.CanvasTexture {
  const k = "emb" + col;
  if (TEX[k]) return TEX[k];
  return (TEX[k] = canvasTex(128, 128, (x) => {
    x.fillStyle = col; rr(x, 6, 6, 116, 116, 34); x.fill();
    x.fillStyle = "#1A1035"; x.beginPath(); x.arc(46, 56, 10, 0, 7); x.arc(82, 56, 10, 0, 7); x.fill();
    x.strokeStyle = "#1A1035"; x.lineWidth = 9; x.lineCap = "round"; x.beginPath(); x.arc(64, 70, 22, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke();
  }));
}

/** Rounded-rect path on a 2D context. */
export function rr(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number): void {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}
