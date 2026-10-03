/* STAGE (prototype section): renderer, lights, floor, input, effects and powers. Power math is verbatim. */
import * as THREE from "three";
import type { CharacterConfig, MotionName, PowerName } from "@orbis/shared";
import { ActorImpl, type ActorHost } from "./actor";
import { makeEnv } from "./environment";
import { addToLoop, removeFromLoop } from "./loop";
import { C, MAT, disposeObj, physical } from "./materials";
import { L, type Mod } from "./motions";
import { getLowPower, withQuality } from "./quality";
import { floorTex, glowTex } from "./textures";
import type { Actor, ActorOptions, Stage, StageOptions } from "./types";

interface Fx {
  t: number;
  d: number;
  u: (p: number, dt: number, m: Mod) => void;
  e?: (() => void) | null;
  a?: ActorImpl;
}

interface ResolvedOptions {
  halfW: number | ((aspect: number) => number);
  halfH: number;
  camY: number;
  lookY: number;
}

const rnd = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const TAP_REACTIONS: readonly MotionName[] = ["wave", "jump", "cheer", "spin", "dance"];

export class StageImpl implements Stage, ActorHost {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly lowPower: boolean;
  actors: ActorImpl[] = [];
  main: ActorImpl | null = null;
  visible = true;
  zoom = 1;
  mouse = { x: 0, y: 0 };
  t = 0;

  private readonly o: ResolvedOptions;
  private readonly onTap?: StageOptions["onTap"];
  private fx: Fx[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly env: THREE.WebGLRenderTarget;
  private readonly key: THREE.DirectionalLight;
  private readonly floors: THREE.Mesh[] = [];
  private readonly unbind: (() => void)[] = [];
  private io: IntersectionObserver | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private disposed = false;
  private _w = 0;
  private _h = 0;

  constructor(canvas: HTMLCanvasElement, options: StageOptions = {}) {
    this.canvas = canvas;
    this.o = {
      halfW: options.halfW ?? 1.05,
      halfH: options.halfH ?? 1.15,
      camY: options.camY ?? 1.05,
      lookY: options.lookY ?? 0.95,
    };
    this.onTap = options.onTap;
    this.lowPower = options.lowPower ?? getLowPower();
    const low = this.lowPower;

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2)); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = !low; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.env = makeEnv(r); this.scene.environment = this.env.texture;
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
    this.scene.add(new THREE.HemisphereLight(0xcfc6ff, 0x1a1440, 0.35));
    const key = (this.key = new THREE.DirectionalLight(0xffffff, 1.45)); key.position.set(2.5, 5.5, 4); key.castShadow = !low; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -2, near: 1, far: 15 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; this.scene.add(key);
    const rim = new THREE.DirectionalLight(C("#9BE8FF"), 1.1); rim.position.set(-4, 3, -4); this.scene.add(rim);
    const rim2 = new THREE.DirectionalLight(C("#FF9FCB"), 0.7); rim2.position.set(4, 2, -3); this.scene.add(rim2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.3 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.12; floor.receiveShadow = true; this.scene.add(floor);
    const gf = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: floorTex(), transparent: true, depthWrite: false, toneMapped: false })); gf.rotation.x = -Math.PI / 2; gf.position.y = -0.121; this.scene.add(gf);
    this.floors.push(floor, gf);
    this.bind();
    if (typeof IntersectionObserver !== "undefined") {
      this.io = new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; }, { rootMargin: "120px" });
      this.io.observe(canvas);
    }
    addToLoop(this);
  }

  addActor(cfg: CharacterConfig, o?: ActorOptions): Actor {
    if (this.disposed) throw new Error("Stage is disposed");
    const a = new ActorImpl(this, cfg, o); this.actors.push(a); if (o && o.main) this.main = a; return a;
  }

  clear(): void {
    this.fx.forEach((f) => f.e && f.e()); this.fx = [];
    this.actors.forEach((a) => a.dispose()); this.actors = []; this.main = null;
  }

  private listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void): void {
    target.addEventListener(type, fn);
    this.unbind.push(() => target.removeEventListener(type, fn));
  }

  private bind(): void {
    const c = this.canvas; let down: { x: number; y: number; moved: boolean } | null = null, lx = 0;
    this.listen(c, "pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, moved: false }; lx = e.clientX; });
    this.listen(c, "pointermove", (e) => {
      if (!down) return;
      if (Math.abs(e.clientX - down.x) > 4) { down.moved = true; if (!c.hasPointerCapture(e.pointerId)) c.setPointerCapture(e.pointerId); }
      if (down.moved && this.main) { this.main.targetRot += (e.clientX - lx) * 0.012; }
      lx = e.clientX;
    });
    this.listen(c, "pointerup", (e) => { if (down && !down.moved) this.tap(e); down = null; });
    this.listen(c, "pointercancel", () => { down = null; });
    const onWinMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      this.mouse.x = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
      this.mouse.y = (e.clientY - (r.top + r.height * 0.32)) / (window.innerHeight / 2);
    };
    window.addEventListener("pointermove", onWinMove, { passive: true });
    this.unbind.push(() => window.removeEventListener("pointermove", onWinMove));
  }

  private tap(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, this.camera);
    const hits = this.ray.intersectObjects(this.actors.map((a) => a.R.root), true);
    if (!hits.length) return;
    const o = hits[0].object;
    const a = this.actors.find((x) => { let n: THREE.Object3D | null = o; while (n) { if (n === x.R.root) return true; n = n.parent; } return false; });
    if (a) { a.play(rnd(TAP_REACTIONS)); if (this.onTap) this.onTap(a, this); }
  }

  private fit(): boolean {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return false;
    if (w !== this._w || h !== this._h) { this._w = w; this._h = h; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const hw = typeof this.o.halfW === "function" ? this.o.halfW(w / h) : this.o.halfW;
    const d = Math.max(this.o.halfH / t, hw / (t * this.camera.aspect)) * this.zoom;
    const zf = Math.max(0, 1 - this.zoom);
    this.camera.position.set(0, this.o.camY + zf * 0.5, d); this.camera.lookAt(0, this.o.lookY + zf * 0.5, 0);
    return true;
  }

  private addFx(d: number, u: Fx["u"], e?: Fx["e"], a?: ActorImpl): void { this.fx.push({ t: 0, d, u, e, a }); }

  /** Called by the shared loop every frame. */
  update(dt: number): void {
    this.t += dt; if (this.disposed || !this.visible || !this.fit()) return;
    const t = this.t;
    this.actors.forEach((a) => a.pose(dt, t, this.mouse));
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; const p = Math.min(1, f.t / f.d); f.u(p, dt, (f.a ? f.a.mod : null) as Mod); if (p >= 1) { if (f.e) f.e(); this.fx.splice(i, 1); } }
    this.actors.forEach((a) => a.finish(dt, t));
    this.renderer.render(this.scene, this.camera);
  }

  private sprite(col: string, s: number, op = 1): THREE.Sprite {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C(col), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: op, toneMapped: false }));
    sp.scale.set(s, s, 1); return sp;
  }

  private burst(origin: THREE.Vector3, n: number, colors: string[], speed: number, d: number, grav = 4): void {
    const g = new THREE.Group(); this.scene.add(g);
    const geos = [new THREE.PlaneGeometry(0.055, 0.09), new THREE.CircleGeometry(0.04, 12)];
    const mats = colors.map((c) => new THREE.MeshBasicMaterial({ color: C(c), side: THREE.DoubleSide, transparent: true, toneMapped: false }));
    const ps: { m: THREE.Mesh; v: THREE.Vector3; r: THREE.Vector3 }[] = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geos[i % 2], mats[i % mats.length]); m.position.copy(origin);
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.5;
      ps.push({ m, v: new THREE.Vector3(Math.cos(th) * Math.cos(ph), Math.sin(ph) + 0.4, Math.sin(th) * Math.cos(ph)).multiplyScalar(speed * (0.5 + Math.random())), r: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(10) });
      g.add(m);
    }
    this.addFx(d, (p, dt) => {
      ps.forEach((q) => { q.v.y -= grav * dt; q.v.multiplyScalar(0.995); q.m.position.addScaledVector(q.v, dt); q.m.rotation.x += q.r.x * dt; q.m.rotation.y += q.r.y * dt; });
      mats.forEach((m) => { m.opacity = 1 - Math.max(0, (p - 0.6) / 0.4); });
    }, () => { this.scene.remove(g); geos.forEach((x) => x.dispose()); mats.forEach((m) => m.dispose()); });
  }

  /** A setTimeout that never fires after dispose(). */
  private later(fn: () => void, ms: number): void {
    const id = setTimeout(() => { this.timers.delete(id); if (!this.disposed) fn(); }, ms);
    this.timers.add(id);
  }

  power(k: PowerName): void {
    if (this.disposed) return;
    withQuality(this.lowPower, () => this.runPower(k));
  }

  private runPower(k: PowerName): void {
    const a = this.main; if (!a) return;
    const R = a.R, col = R.cfg.glow, sc = a.scale, bx = a.base.x, bz = a.base.z;
    if (k === "orb") {
      const o = new THREE.Group(); o.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), MAT.glow("#ffffff"))); o.add(this.sprite(col, 0.7)); o.add(new THREE.PointLight(C(col), 1.6, 3)); this.scene.add(o);
      a.play("point"); a.setExpr("focus", 3);
      this.addFx(3.4, (p, dt, m) => { const ang = p * Math.PI * 5, s = Math.max(0.001, Math.min(1, p * 7, (1 - p) * 7)); o.scale.setScalar(s); o.position.set(bx + m.x + Math.cos(ang) * 0.85 * sc, (1.05 + Math.sin(p * Math.PI * 7) * 0.16) * sc + m.y, bz + Math.sin(ang) * 0.85 * sc); },
        () => { this.scene.remove(o); disposeObj(o); }, a);
    }
    if (k === "shield") {
      const g = new THREE.Group();
      const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), MAT.basic(col, { wireframe: true, transparent: true, opacity: 0.7 }));
      const fill = new THREE.Mesh(new THREE.SphereGeometry(0.98, 40, 24), physical({ color: C(col), transparent: true, opacity: 0.1, roughness: 0, clearcoat: 1, depthWrite: false }));
      g.add(wire, fill); g.position.set(bx, 0.95 * sc, bz); this.scene.add(g); a.setExpr("focus", 2.8);
      this.addFx(2.8, (p, dt, m) => {
        const s = p < 0.2 ? 1 - Math.pow(1 - p / 0.2, 3) : 1; g.scale.setScalar(Math.max(0.001, s) * sc); g.rotation.y += dt * 0.8; g.position.x = bx + m.x;
        const f = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1; wire.material.opacity = 0.7 * f; fill.material.opacity = 0.1 * f;
      }, () => { this.scene.remove(g); disposeObj(g); }, a);
    }
    if (k === "blink") {
      const side = Math.random() > 0.5 ? 1 : -1, cols = [col, "#ffffff", "#CFC6FF"];
      a.setExpr("surprised", 0.5);
      this.burst(new THREE.Vector3(bx, 1 * sc, bz), 34, cols, 1.4, 1, 1);
      this.later(() => this.burst(new THREE.Vector3(bx + 0.5 * side * sc, 1 * sc, bz), 34, cols, 1.4, 1, 1), 220);
      this.addFx(1.9, (p, dt, m) => {
        const T = p * 1.9; let s = 1, x = 0;
        if (T < 0.2) s = 1 - T / 0.2; else if (T < 0.4) { s = (T - 0.2) / 0.2; x = 0.5; } else if (T < 1.3) x = 0.5; else if (T < 1.5) { s = 1 - (T - 1.3) / 0.2; x = 0.5; } else if (T < 1.7) s = (T - 1.5) / 0.2;
        m.s *= Math.max(0.001, s); m.x += x * side * sc; if (T > 0.4 && T < 0.5) a.setExpr("happy", 0.8);
      }, null, a);
    }
    if (k === "levitate") {
      a.setExpr("happy", 3.4);
      this.addFx(3.4, (p, dt, m) => {
        const up = Math.sin((Math.min(1, p / 0.25) * Math.PI) / 2) * (p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1);
        m.y += up * (0.45 + Math.sin(p * Math.PI * 6) * 0.05) * sc;
        R.legs.forEach((g, i) => { g.rotation.x = L(g.rotation.x, i ? 0.3 : -0.1, up); });
        R.arms.forEach((g, i) => { g.rotation.z = L(g.rotation.z, (i ? 1 : -1) * 0.65, up); });
      }, null, a);
    }
    if (k === "scan") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.013, 8, 80), MAT.basic(col, { transparent: true })); ring.rotation.x = Math.PI / 2;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 64), MAT.basic(col, { transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2;
      this.scene.add(ring, disc); a.setExpr("focus", 2.6);
      this.addFx(2.6, (p, dt, m) => {
        const y = ((1 - Math.cos(p * Math.PI * 2)) / 2) * 1.95 * sc; ring.position.set(bx + m.x, y, bz); disc.position.set(bx + m.x, y, bz); ring.scale.setScalar(sc); disc.scale.setScalar(sc);
        const f = Math.min(1, p * 8, (1 - p) * 8); ring.material.opacity = f; disc.material.opacity = 0.08 * f;
      }, () => { this.scene.remove(ring, disc); disposeObj(ring); disposeObj(disc); }, a);
    }
    if (k === "hype") { a.play("cheer"); this.burst(new THREE.Vector3(bx, 1.9 * sc, bz), 110, [col, "#FF8FB8", "#FFB38A", "#8B7CFF", "#6EF0D2", "#FFE27A"], 2.7, 2.6); }
  }

  snapshot(type: "image/png" | "image/webp" = "image/png"): string {
    if (this.disposed) return "";
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL(type);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    removeFromLoop(this);
    this.timers.forEach((id) => clearTimeout(id)); this.timers.clear();
    this.unbind.forEach((off) => off()); this.unbind.length = 0;
    if (this.io) { this.io.disconnect(); this.io = null; }
    this.clear();
    this.floors.forEach((f) => { this.scene.remove(f); disposeObj(f); });
    this.scene.environment = null;
    this.env.dispose();
    (this.key.shadow as unknown as { dispose?: () => void }).dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
