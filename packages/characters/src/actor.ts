/* ACTOR (prototype section). pose/finish math is verbatim from the prototype. */
import * as THREE from "three";
import { normalizeCharacter, type CharacterConfig, type Expression, type MotionName } from "@orbis/shared";
import { applyFace, buildCharacter, disposeRig, type Rig } from "./builder";
import { makePedestal, pedestalData } from "./environment";
import { C, disposeObj } from "./materials";
import { MOTIONS, clamp, type Mod } from "./motions";
import type { Actor, ActorOptions } from "./types";

/** What an actor needs from its stage. */
export interface ActorHost {
  scene: THREE.Scene;
  lowPower: boolean;
}

export class ActorImpl implements Actor {
  readonly stage: ActorHost;
  readonly base: THREE.Vector3;
  readonly baseRot: number;
  rot: number;
  targetRot: number;
  readonly scale: number;
  readonly phase: number;
  look = { x: 0, y: 0 };
  motion: { n: MotionName; t: number; d: number } | null = null;
  expr: Expression = "neutral";
  exprT = 0;
  blinkT: number;
  blink = false;
  talking = false;
  mod: Mod = { x: 0, y: 0, s: 1, sy: 1, ry: 0 };
  readonly ped: THREE.Group;
  R!: Rig;
  prevY: number | null = null;
  prevR = 0;
  private cfg!: CharacterConfig;

  constructor(stage: ActorHost, cfg: CharacterConfig, o: ActorOptions = {}) {
    this.stage = stage; this.base = new THREE.Vector3(o.x || 0, 0, o.z || 0); this.baseRot = o.rot || 0; this.rot = this.baseRot; this.targetRot = this.baseRot;
    this.scale = o.scale || 1; this.phase = Math.random() * 6;
    this.blinkT = 1 + Math.random() * 3;
    const c = normalizeCharacter(cfg);
    this.ped = makePedestal(c.glow, stage.lowPower); this.ped.position.copy(this.base); this.ped.scale.setScalar(this.scale); stage.scene.add(this.ped);
    this.set(c);
  }

  get config(): CharacterConfig {
    return this.cfg;
  }

  get isPlaying(): boolean {
    return this.motion !== null;
  }

  setConfig(config: CharacterConfig): void {
    this.set(config);
  }

  setExpression(expr: Expression, durationSec = 0): void {
    this.setExpr(expr, durationSec);
  }

  /** Prototype Actor.set: rebuild the character and recolor the pedestal rings. */
  set(raw: CharacterConfig): void {
    const cfg = normalizeCharacter(raw);
    if (this.R) { this.stage.scene.remove(this.R.root); disposeRig(this.R); }
    this.cfg = cfg;
    this.R = buildCharacter(cfg, { lowPower: this.stage.lowPower }); this.stage.scene.add(this.R.root); this.prevY = null;
    const u = pedestalData(this.ped); u.ring.material.color.copy(C(cfg.glow)); u.ring2.material.color.copy(C(cfg.glow));
  }

  setExpr(e: Expression, d = 0): void { this.expr = e; this.exprT = d; }

  play(n: MotionName): void { const m = MOTIONS[n]; if (!m) return; this.motion = { n, t: 0, d: m.d }; if (m.expr) this.setExpr(m.expr, m.d); }

  pose(dt: number, t: number, mouse: { x: number; y: number }): void {
    const R = this.R, m = this.mod; m.x = 0; m.y = 0; m.s = 1; m.sy = 1; m.ry = 0;
    this.rot += (this.targetRot - this.rot) * Math.min(1, dt * 7);
    const br = Math.sin(t * 2.2 + this.phase);
    R.hips.position.y = R.hipY + br * 0.006 + (R.flame ? Math.sin(t * 2 + this.phase) * 0.05 : 0);
    R.torso.rotation.set(0, 0, 0); R.torso.position.y = 0; R.torso.scale.set(1, 1 + br * 0.014, 1);
    R.arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(Math.sin(t * 1.5 + i * 1.7 + this.phase) * 0.05, 0, s * (R.armRest + br * 0.02)); });
    R.legs.forEach((g) => g.rotation.set(0, 0, 0));
    this.look.x += (clamp(mouse.x, -1, 1) * 0.55 - this.look.x) * Math.min(1, dt * 5);
    this.look.y += (clamp(mouse.y, -1, 1) * 0.3 - this.look.y) * Math.min(1, dt * 5);
    R.head.rotation.set(this.look.y * 0.7, clamp(this.look.x - (this.rot - this.baseRot) * 0.6, -0.7, 0.7), Math.sin(t * 1.1 + this.phase) * 0.035);
    R.eyePivots.forEach((p) => { p.rotation.y = p.userData.yaw + this.look.x * 0.08; p.rotation.x = -p.userData.pitch + this.look.y * 0.06; });
    if (this.motion) {
      const mo = this.motion; mo.t += dt; const p = Math.min(1, mo.t / mo.d);
      const e = Math.min(1, p / 0.15, (1 - p) / 0.15), ee = e * e * (3 - 2 * e);
      MOTIONS[mo.n].f(p, R, ee, m); if (p >= 1) this.motion = null;
    }
  }

  finish(dt: number, t: number): void {
    const R = this.R, m = this.mod;
    R.root.position.set(this.base.x + m.x, m.y, this.base.z);
    R.root.rotation.y = this.rot + m.ry;
    R.root.scale.set(this.scale * m.s, this.scale * m.s * m.sy, this.scale * m.s);
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = true; if (this.blinkT < -0.12) { this.blink = false; this.blinkT = 1.8 + Math.random() * 3.2; } }
    if (this.exprT > 0) { this.exprT -= dt; if (this.exprT <= 0) this.expr = "neutral"; }
    if (this.talking && this.exprT <= 0) this.expr = "talk";
    applyFace(this, t);
    const hy = R.hips.position.y + m.y, cr = this.rot + m.ry;
    if (this.prevY == null) { this.prevY = hy; this.prevR = cr; }
    const vy = (hy - this.prevY) / dt, vr = (cr - this.prevR) / dt; this.prevY = hy; this.prevR = cr;
    R.springs.forEach((s) => {
      const tx = (clamp(vy * 0.25, -0.8, 0.8) + Math.sin(t * 2.2 + this.phase) * 0.03) * s.amp, tz = clamp(-vr * 0.08, -0.6, 0.6) * s.amp;
      s.vx += ((tx - s.ax) * s.k - s.vx * 5) * dt; s.ax += s.vx * dt; s.vz += ((tz - s.az) * s.k - s.vz * 5) * dt; s.az += s.vz * dt;
      s.o.rotation.x = s.bx + s.ax; s.o.rotation.z = s.bz + s.az;
    });
    R.wings.forEach((w) => { w.g.rotation.y = w.s * (0.45 + Math.sin(t * 6 + this.phase) * 0.35); });
    R.jets.forEach((j, i) => { const k = 0.26 + Math.sin(t * 40 + i * 2) * 0.03 + Math.random() * 0.03; j.scale.set(k, k * 1.5, 1); });
    if (R.flame) { const k = 0.5 + Math.sin(t * 30) * 0.05; R.flame.scale.set(k, k, 1); }
    if (R.aura) { R.aura.g.rotation.y += dt * 0.7; R.aura.sp.forEach((sp, i) => { const k = 0.1 + (Math.sin(t * 3 + i * 1.7) * 0.5 + 0.5) * 0.12; sp.scale.set(k, k, 1); sp.position.y += Math.sin(t * 1.5 + i) * dt * 0.05; }); }
    if (R.galaxy) R.galaxy.rotation.y += dt * 0.55;
    if (R.halo) { R.halo.position.y = (R.haloY as number) + Math.sin(t * 2 + this.phase) * 0.025; R.halo.rotation.y += dt * 0.6; }
    if (R.buddy) { const b = R.buddy; b.position.y = 1.38 + Math.sin(t * 2.4 + this.phase) * 0.07; b.position.x = 0.62 + Math.sin(t * 0.8) * 0.04; b.rotation.y = Math.sin(t * 1.2) * 0.4 + this.look.x * 0.6; b.rotation.z = Math.sin(t * 2.4) * 0.08; b.scale.y = this.blink ? 0.97 : 1; }
    const cs = pedestalData(this.ped).cs; cs.material.opacity = 0.6 * (1 - clamp(m.y * 1.3, 0, 0.8)); cs.position.x = m.x / this.scale; cs.scale.setScalar(m.s);
  }

  /** Dispose the character (geometries, materials, bot-face texture) and the pedestal. Shared textures are kept. */
  dispose(): void {
    this.stage.scene.remove(this.R.root); disposeRig(this.R);
    this.stage.scene.remove(this.ped); disposeObj(this.ped);
  }
}
