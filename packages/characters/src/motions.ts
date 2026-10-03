/* MOTIONS (prototype section). Math is verbatim from the prototype. */
import type { Expression, MotionName } from "@orbis/shared";
import type { Rig } from "./builder";

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const L = (a: number, b: number, e: number): number => a + (b - a) * e;

/** Per-frame pose modifiers (actor.mod in the prototype). */
export interface Mod {
  x: number;
  y: number;
  s: number;
  sy: number;
  ry: number;
}

export interface MotionDef {
  /** Duration in seconds. */
  d: number;
  expr: Expression;
  f(p: number, R: Rig, e: number, m: Mod): void;
}

export const MOTIONS: Record<MotionName, MotionDef> = {
  wave: { d: 2.2, expr: "happy", f(p, R, e) { const a = R.arms[1]; a.rotation.z = L(a.rotation.z, 2.6 + Math.sin(p * Math.PI * 9) * 0.3, e); a.rotation.x = L(a.rotation.x, -0.3, e); R.head.rotation.z += 0.14 * e; } },
  nod: { d: 1.6, expr: "happy", f(p, R, e) { R.head.rotation.x += Math.sin(p * Math.PI * 6) * 0.25 * e; } },
  jump: { d: 1.35, expr: "surprised", f(p, R, e, m) {
    const c = p < 0.22 ? Math.sin((p / 0.22) * Math.PI) : 0, j = p > 0.22 && p < 0.82 ? Math.sin(((p - 0.22) / 0.6) * Math.PI) : 0, l = p > 0.82 ? Math.sin(((p - 0.82) / 0.18) * Math.PI) : 0;
    m.y += j * 0.55; m.sy *= 1 - c * 0.12 - l * 0.1 + j * 0.07;
    R.arms.forEach((a, i) => { a.rotation.z = L(a.rotation.z, (i ? 1 : -1) * 2.4, j); });
    R.legs.forEach((g, i) => { g.rotation.x = (i ? 1 : -1) * j * 0.3; });
  } },
  dance: { d: 3.2, expr: "happy", f(p, R, e, m) {
    const b = Math.sin(p * Math.PI * 10);
    m.y += Math.abs(b) * 0.06 * e; R.torso.rotation.z = b * 0.14 * e; R.torso.rotation.y = Math.sin(p * Math.PI * 5) * 0.35 * e;
    R.arms[0].rotation.z = L(R.arms[0].rotation.z, -(1.4 + b * 0.9), e); R.arms[1].rotation.z = L(R.arms[1].rotation.z, 1.4 - b * 0.9, e);
    R.head.rotation.z -= b * 0.12 * e; if (R.legs[0]) { R.legs[0].rotation.x = Math.max(0, b) * 0.35 * e; R.legs[1].rotation.x = Math.max(0, -b) * 0.35 * e; }
  } },
  think: { d: 2.8, expr: "focus", f(p, R, e) {
    const a = R.arms[1]; a.rotation.x = L(a.rotation.x, -2.3, e); a.rotation.z = L(a.rotation.z, -0.5, e);
    const b = R.arms[0]; b.rotation.x = L(b.rotation.x, -0.8, e); b.rotation.z = L(b.rotation.z, 0.55, e);
    R.head.rotation.z += 0.16 * e; R.head.rotation.y += Math.sin(p * Math.PI * 2) * 0.2 * e;
  } },
  cheer: { d: 1.8, expr: "happy", f(p, R, e, m) {
    R.arms.forEach((a, i) => { a.rotation.z = L(a.rotation.z, (i ? 1 : -1) * (2.8 + Math.sin(p * Math.PI * 10) * 0.15), e); });
    const h = Math.abs(Math.sin(p * Math.PI * 4)); m.y += h * 0.14 * e; m.sy *= 1 + h * 0.04 * e;
  } },
  shrug: { d: 1.6, expr: "surprised", f(p, R) {
    const k = Math.sin(p * Math.PI);
    R.arms.forEach((a, i) => { a.rotation.z = L(a.rotation.z, (i ? 1 : -1) * 0.7, k); a.rotation.x = L(a.rotation.x, -0.8, k); });
    R.head.rotation.z += 0.22 * k; R.torso.position.y = 0.02 * k;
  } },
  point: { d: 2, expr: "happy", f(p, R, e) { const a = R.arms[1]; a.rotation.x = L(a.rotation.x, -1.55, e); a.rotation.z = L(a.rotation.z, 0.05, e); R.head.rotation.y += 0.2 * e; R.torso.rotation.y = 0.15 * e; } },
  spin: { d: 1.4, expr: "happy", f(p, R, e, m) { m.ry += ((1 - Math.cos(p * Math.PI)) / 2) * Math.PI * 2; const k = Math.sin(p * Math.PI); R.arms.forEach((a, i) => { a.rotation.z = L(a.rotation.z, (i ? 1 : -1) * 1.1, k); }); m.y += k * 0.08; } },
  bow: { d: 2, expr: "happy", f(p, R, e) { R.torso.rotation.x = 0.45 * e; R.head.rotation.x += 0.25 * e; R.arms.forEach((a) => { a.rotation.x = L(a.rotation.x, 0.3, e); }); } },
};
