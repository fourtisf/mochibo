/* CHARACTER BUILDER (prototype section): buildCharacter, buildHair, buildHat, buildBack, applyFace, bot face. */
import * as THREE from "three";
import { normalizeCharacter, type CharacterConfig, type Expression } from "@orbis/shared";
import { getLowPower, withQuality } from "./quality";
import { blushTex, emblemTex, eyeTex, glowTex, rr } from "./textures";
import { C, MAT, SK, cap, disposeObj, lathe, phys, physical, place, rbox, rrPlane, shadeHex, sph, surf } from "./materials";

export interface Spring {
  o: THREE.Object3D;
  bx: number;
  bz: number;
  ax: number;
  vx: number;
  az: number;
  vz: number;
  k: number;
  amp: number;
}

export interface MouthRig {
  smile: THREE.Mesh;
  cat: THREE.Group;
  open: THREE.Group;
  base: CharacterConfig["mouth"];
}

export interface BotFace {
  tex: THREE.CanvasTexture;
  key: string;
  draw(expr: string, blink: boolean, open: boolean): void;
}

/** The rig (R in the prototype): handles to every animated part of a built character. */
export interface Rig {
  root: THREE.Group;
  cfg: CharacterConfig;
  bot: boolean;
  arms: THREE.Group[];
  legs: THREE.Group[];
  eyes: THREE.Mesh[];
  eyePivots: THREE.Group[];
  happy: THREE.Mesh[];
  brows: THREE.Group[];
  springs: Spring[];
  wings: { g: THREE.Group; s: number }[];
  jets: THREE.Sprite[];
  armRest: number;
  hipY: number;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  skull: THREE.Group;
  flame?: THREE.Sprite;
  core?: THREE.Mesh;
  mouth?: MouthRig;
  hair?: THREE.Group;
  face?: BotFace;
  buddy?: THREE.Group;
  halo?: THREE.Group;
  haloY?: number;
}

export interface Mats {
  skin: THREE.Material;
  top: THREE.Material;
  bottom: THREE.Material;
  shoe: THREE.Material;
  sole: THREE.Material;
  hair: THREE.Material;
  acc: THREE.Material;
  accF: THREE.Material;
  glow: THREE.Material;
  dark: THREE.Material;
}

export type SpringFn = (o: THREE.Object3D, k?: number, amp?: number) => void;

/* ---------------- bot face (LED screen) ---------------- */

export function drawBotFace(x: CanvasRenderingContext2D, W: number, H: number, glow: string, expr: string, blink: boolean, open: boolean): void {
  x.clearRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1B1446"); g.addColorStop(1, "#0A0720"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(255,255,255,.035)"; for (let y = 0; y < H; y += 6) x.fillRect(0, y, W, 2);
  x.shadowColor = glow; x.shadowBlur = 22; x.fillStyle = glow; x.strokeStyle = glow; x.lineCap = "round"; x.lineWidth = 13;
  const ex = [W * 0.31, W * 0.69], ey = H * 0.43;
  if (expr === "happy") ex.forEach((cx) => { x.beginPath(); x.arc(cx, ey + 12, 24, Math.PI * 1.12, Math.PI * 1.88); x.stroke(); });
  else if (expr === "love") ex.forEach((cx) => heart(x, cx, ey, 30));
  else if (expr === "focus") ex.forEach((cx) => { rr(x, cx - 26, ey - 7, 52, 14, 7); x.fill(); });
  else if (expr === "surprised") ex.forEach((cx) => { x.beginPath(); x.arc(cx, ey, 24, 0, 7); x.fill(); });
  else if (blink) ex.forEach((cx) => { rr(x, cx - 24, ey - 4, 48, 8, 4); x.fill(); });
  else {
    ex.forEach((cx) => { rr(x, cx - 19, ey - 28, 38, 56, 19); x.fill(); });
    x.shadowBlur = 0; x.fillStyle = "rgba(255,255,255,.9)"; ex.forEach((cx) => { x.beginPath(); x.arc(cx + 7, ey - 13, 7, 0, 7); x.fill(); });
    x.fillStyle = glow; x.shadowBlur = 22;
  }
  const my = H * 0.76;
  if (open || expr === "happy" || expr === "love" || expr === "surprised") { x.beginPath(); x.ellipse(W / 2, my, 20, open ? 15 : 11, 0, 0, 7); x.fill(); }
  else { x.lineWidth = 10; x.beginPath(); x.arc(W / 2, my - 16, 20, Math.PI * 0.22, Math.PI * 0.78); x.stroke(); }
  x.shadowBlur = 0; x.fillStyle = "rgba(255,143,184,.38)"; [W * 0.15, W * 0.85].forEach((cx) => { x.beginPath(); x.ellipse(cx, H * 0.63, 17, 10, 0, 0, 7); x.fill(); });
}

function heart(x: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  x.beginPath(); x.moveTo(cx, cy + s * 0.55);
  x.bezierCurveTo(cx - s * 1.1, cy - s * 0.2, cx - s * 0.5, cy - s * 0.95, cx, cy - s * 0.35);
  x.bezierCurveTo(cx + s * 0.5, cy - s * 0.95, cx + s * 1.1, cy - s * 0.2, cx, cy + s * 0.55);
  x.fill();
}

/** Per-actor bot face. Its CanvasTexture is NOT shared: dispose it with the rig. */
export function makeBotFace(glow: string): BotFace {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 184; const x = cv.getContext("2d") as CanvasRenderingContext2D;
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  const f: BotFace = {
    tex,
    key: "",
    draw(expr, blink, open) {
      const k = expr + "|" + blink + "|" + open;
      if (k === f.key) return;
      f.key = k;
      drawBotFace(x, 256, 184, glow, expr, blink, open);
      tex.needsUpdate = true;
    },
  };
  f.draw("neutral", false, false);
  return f;
}

/* ---------------- character ---------------- */

export interface BuildOptions {
  /** Low-power materials (MeshStandardMaterial instead of MeshPhysicalMaterial). Default: getLowPower(). */
  lowPower?: boolean;
}

export function buildCharacter(raw: Partial<CharacterConfig>, opts: BuildOptions = {}): Rig {
  return withQuality(opts.lowPower ?? getLowPower(), () => build(raw));
}

function build(raw: Partial<CharacterConfig>): Rig {
  const c = normalizeCharacter(raw), bot = c.kind === "bot", hover = bot && c.legs === "hover";
  const root = new THREE.Group();
  const R = { root, cfg: c, bot, arms: [], legs: [], eyes: [], eyePivots: [], happy: [], brows: [], springs: [], wings: [], jets: [], armRest: bot ? 0.26 : 0.3, hipY: hover ? 0.72 : 0.53 } as unknown as Rig;
  const M: Mats = {
    skin: MAT.skin(c.skin), top: bot ? MAT.metal(c.topC) : MAT.fabric(c.topC), bottom: bot ? MAT.vinyl(c.bottomC) : MAT.fabric(c.bottomC),
    shoe: MAT.vinyl(c.shoeC), sole: MAT.vinyl("#F2EFFF"), hair: MAT.hair(c.hairC), acc: MAT.vinyl(c.accC), accF: MAT.fabric(c.accC), glow: MAT.glow(c.glow), dark: MAT.dark(),
  };
  const spring: SpringFn = (o, k = 55, amp = 1) => { R.springs.push({ o, bx: o.rotation.x, bz: o.rotation.z, ax: 0, vx: 0, az: 0, vz: 0, k, amp }); };

  const hips = new THREE.Group(); hips.position.y = R.hipY; root.add(hips); R.hips = hips;

  /* legs / hover */
  if (!hover) {
    [-1, 1].forEach((s) => {
      const leg = new THREE.Group(); leg.position.x = 0.105 * s; hips.add(leg); R.legs.push(leg);
      if (bot) {
        const p = cap(0.06, 0.2, M.bottom); p.position.y = -0.24; leg.add(p);
        const f = rbox(0.17, 0.1, 0.25, 0.05, M.shoe); f.position.set(0, -0.478, 0.03); leg.add(f);
      } else {
        const pant = cap(0.092, 0.2, M.bottom); pant.position.y = -0.2; leg.add(pant);
        const sh = new THREE.Group(); sh.position.y = -0.43; leg.add(sh);
        const up = sph(0.11, M.shoe, 0, 0, 0.035); up.scale.set(1, 0.72, 1.35); sh.add(up);
        const so = new THREE.Mesh(new THREE.CylinderGeometry(0.116, 0.116, 0.05, 32), M.sole); so.scale.z = 1.38; so.position.set(0, -0.07, 0.035); sh.add(so);
        [[0.066, 0.085], [0.05, 0.12]].forEach(([y, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.02), M.sole); l.position.set(0, y, z); l.rotation.x = -0.5; sh.add(l); });
      }
    });
  } else {
    const th = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 28), M.bottom); th.rotation.x = Math.PI; th.position.y = -0.17; hips.add(th);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 10, 32), M.glow); ring.rotation.x = Math.PI / 2; ring.position.y = -0.26; hips.add(ring);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C(c.glow), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    fl.position.y = -0.34; hips.add(fl); R.flame = fl;
  }
  const pelvis = lathe([[0, -0.09], [0.15, -0.09], [0.225, -0.04], [0.25, 0.03], [0.247, 0.1], [0, 0.1]], M.bottom); pelvis.scale.z = 0.85; hips.add(pelvis);

  /* torso */
  const torso = new THREE.Group(); hips.add(torso); R.torso = torso;
  const tr = lathe([[0, 0.065], [0.258, 0.065], [0.265, 0.16], [0.258, 0.3], [0.225, 0.42], [0.15, 0.49], [0, 0.505]], M.top); tr.scale.z = 0.85; torso.add(tr);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.258, 0.027, 10, 48), bot ? M.bottom : MAT.fabric(shadeHex(c.topC, 0.82)));
  hem.rotation.x = Math.PI / 2; hem.scale.y = 0.85; hem.position.y = 0.078; torso.add(hem);

  if (bot) {
    const panel = rrPlane(0.2, 0.13, 0.04, M.dark); panel.position.set(0, 0.3, 0.222); torso.add(panel);
    const core = sph(0.03, M.glow, 0, 0.3, 0.228); core.scale.z = 0.4; torso.add(core); R.core = core;
    [-1, 1].forEach((s) => torso.add(sph(0.013, M.glow, 0.066 * s, 0.3, 0.226)));
  } else {
    if (c.top === "hoodie") {
      const hood = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.078, 14, 32), M.top); hood.position.set(0, 0.46, -0.08); hood.rotation.x = Math.PI / 2 - 0.5; torso.add(hood);
      const pk = sph(0.13, MAT.fabric(shadeHex(c.topC, 0.86)), 0, 0.17, 0.208); pk.scale.set(1.3, 0.5, 0.22); torso.add(pk);
      [-1, 1].forEach((s) => { const st = cap(0.009, 0.1, M.sole); st.position.set(0.055 * s, 0.37, 0.214); torso.add(st); torso.add(sph(0.016, M.acc, 0.055 * s, 0.305, 0.222)); });
    }
    if (c.top === "bomber") {
      const col = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.036, 12, 32), MAT.fabric(shadeHex(c.topC, 0.65))); col.position.y = 0.475; col.rotation.x = Math.PI / 2; torso.add(col);
      const zip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.36, 0.008), MAT.metal("#E8E4FF")); zip.position.set(0, 0.27, 0.225); torso.add(zip);
      torso.add(sph(0.016, MAT.metal("#E8E4FF"), 0, 0.41, 0.222));
      const hb = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 10, 48), MAT.fabric(shadeHex(c.topC, 0.65))); hb.rotation.x = Math.PI / 2; hb.scale.y = 0.85; hb.position.y = 0.08; torso.add(hb);
    }
    if (c.top === "tee") { const nk = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 32), MAT.fabric(shadeHex(c.topC, 0.8))); nk.rotation.x = Math.PI / 2; nk.position.y = 0.485; torso.add(nk); }
    if (c.top === "overalls") {
      const bib = rbox(0.3, 0.22, 0.045, 0.05, M.bottom); bib.position.set(0, 0.25, 0.228); torso.add(bib);
      [-1, 1].forEach((s) => {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.02), M.bottom); st.position.set(0.1 * s, 0.42, 0.2); st.rotation.x = -0.4; torso.add(st);
        torso.add(sph(0.022, M.acc, 0.1 * s, 0.33, 0.254));
        const bk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), M.bottom); bk.position.set(0.1 * s, 0.35, -0.205); bk.rotation.x = 0.25; torso.add(bk);
      });
    }
    if (c.top !== "overalls") {
      const em = rrPlane(0.085, 0.085, 0.026, new THREE.MeshBasicMaterial({ map: emblemTex(c.glow), transparent: true, toneMapped: false }));
      em.position.set(-0.1, 0.33, 0.202); em.rotation.y = -0.36; torso.add(em);
    }
  }

  /* arms */
  const shortSleeve = !bot && (c.top === "tee" || c.top === "overalls");
  [-1, 1].forEach((s) => {
    const arm = new THREE.Group(); arm.position.set(0.235 * s, 0.41, 0); torso.add(arm);
    arm.add(sph(0.082, bot ? M.bottom : M.top));
    if (shortSleeve) {
      const sl = cap(0.084, 0.05, M.top); sl.position.y = -0.05; arm.add(sl);
      const fa = cap(0.062, 0.15, M.skin); fa.position.y = -0.17; arm.add(fa);
    } else {
      const up = cap(0.072, 0.17, M.top); up.position.y = -0.12; arm.add(up);
      if (!bot) { const cf = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.022, 8, 24), MAT.fabric(shadeHex(c.topC, 0.78))); cf.rotation.x = Math.PI / 2; cf.position.y = -0.23; arm.add(cf); }
    }
    const hand = new THREE.Group(); hand.position.y = -0.29; arm.add(hand);
    const palm = sph(0.07, bot ? M.bottom : M.skin); palm.scale.set(1, 1.05, 0.88); hand.add(palm);
    hand.add(sph(0.03, bot ? M.bottom : M.skin, -0.045 * s, 0.015, 0.035));
    arm.rotation.z = R.armRest * s; R.arms.push(arm);
  });

  /* head */
  const head = new THREE.Group(); head.position.y = 0.5; torso.add(head); R.head = head;
  const sk = new THREE.Group(); sk.position.y = bot ? 0.37 : 0.32; head.add(sk); R.skull = sk;
  if (!bot) {
    const neck = cap(0.08, 0.04, M.skin); neck.position.y = 0.02; head.add(neck);
    const skull = sph(0.42, M.skin, 0, 0, 0, 56); skull.scale.set(1, 0.94, 0.96); sk.add(skull);
    [-1, 1].forEach((s) => { const e = sph(0.075, M.skin, 0.402 * s, -0.03, -0.02); e.scale.set(0.55, 1, 0.8); sk.add(e); });
    const eyeM = new THREE.MeshBasicMaterial({ map: eyeTex(c.eyeC), transparent: true, toneMapped: false });
    const darkB = MAT.basic("#1E1236");
    [-1, 1].forEach((s) => {
      const pv = new THREE.Group(); pv.rotation.order = "YXZ"; pv.userData = { yaw: 0.35 * s, pitch: -0.07 }; pv.rotation.set(0.07, 0.35 * s, 0); sk.add(pv); R.eyePivots.push(pv);
      const e = new THREE.Mesh(new THREE.CircleGeometry(0.1, 48), eyeM); e.position.z = SK.rz + 0.006; e.scale.y = 1.16; pv.add(e); R.eyes.push(e);
      const hp = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.017, 8, 24, Math.PI), darkB); hp.position.set(0, -0.025, SK.rz + 0.006); hp.visible = false; pv.add(hp); R.happy.push(hp);
      if (c.lashes) { const l = cap(0.01, 0.045, darkB); l.position.set(0.092 * s, 0.085, SK.rz - 0.004); l.rotation.z = -0.95 * s; pv.add(l); const l2 = l.clone(); l2.position.set(0.07 * s, 0.11, SK.rz - 0.01); l2.rotation.z = -0.55 * s; pv.add(l2); }
      const bp = new THREE.Group(); bp.rotation.order = "YXZ"; bp.rotation.set(-0.25, 0.33 * s, 0); sk.add(bp);
      const b = cap(0.016, 0.055, M.hair); b.rotation.z = Math.PI / 2 + 0.15 * s; b.position.z = SK.rz + 0.004; bp.add(b); R.brows.push(bp);
      if (c.blush) { const bl = new THREE.Mesh(new THREE.CircleGeometry(0.08, 32), new THREE.MeshBasicMaterial({ map: blushTex(), transparent: true, depthWrite: false, toneMapped: false })); place(bl, surf(0.58 * s, -0.24, 0.005)); bl.scale.y = 0.62; sk.add(bl); }
      if (c.freckles) ([[0.5, -0.17], [0.57, -0.12], [0.63, -0.19], [0.46, -0.11]] as const).forEach(([y, p]) => { const f = sph(0.009, MAT.skin(shadeHex(c.skin, 0.72)), 0, 0, 0, 10); place(f, surf(y * s, p, -0.003)); sk.add(f); });
    });
    const nose = sph(0.024, MAT.skin(shadeHex(c.skin, 0.93)), 0, 0, 0, 16); place(nose, surf(0, -0.15, -0.006)); sk.add(nose);
    const mg = new THREE.Group(); place(mg, surf(0, -0.27, 0.003)); sk.add(mg);
    const md = MAT.basic("#4A1630");
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.011, 8, 20, Math.PI), md); smile.rotation.z = Math.PI; smile.position.y = 0.02; mg.add(smile);
    const catM = new THREE.Group(); [-1, 1].forEach((s) => { const a = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.009, 8, 16, Math.PI), md); a.rotation.z = Math.PI; a.position.set(0.024 * s, 0.01, 0); catM.add(a); }); mg.add(catM);
    const open = new THREE.Group(); const om = new THREE.Mesh(new THREE.CircleGeometry(0.05, 32), md); om.scale.y = 0.78; open.add(om);
    const tg = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), MAT.basic("#FF7FA0")); tg.position.set(0, -0.02, 0.001); tg.scale.y = 0.6; open.add(tg); open.visible = false; mg.add(open);
    smile.visible = c.mouth !== "cat"; catM.visible = c.mouth === "cat";
    R.mouth = { smile, cat: catM, open, base: c.mouth };
    buildHair(sk, c, M, R, spring);
    if (c.glasses === "round") {
      const fm = MAT.metal("#2A2350");
      [-1, 1].forEach((s) => {
        const pv = new THREE.Group(); pv.rotation.order = "YXZ"; pv.rotation.set(0.07, 0.35 * s, 0); sk.add(pv);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.014, 10, 40), fm); ring.position.z = SK.rz + 0.055; pv.add(ring);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.115, 40), physical({ color: C("#DCEBFF"), transparent: true, opacity: 0.16, roughness: 0, clearcoat: 1 })); lens.position.z = SK.rz + 0.052; pv.add(lens);
      });
      const br = cap(0.011, 0.06, fm); br.rotation.z = Math.PI / 2; place(br, surf(0, -0.04, 0.075)); br.rotateZ(Math.PI / 2); sk.add(br);
    }
    if (c.glasses === "shades") {
      const sm = phys("#120B2A", { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.3 });
      [-1, 1].forEach((s) => { const pv = new THREE.Group(); pv.rotation.order = "YXZ"; pv.rotation.set(0.06, 0.33 * s, 0); sk.add(pv); const l = rbox(0.23, 0.16, 0.025, 0.06, sm); l.position.z = SK.rz + 0.045; pv.add(l); });
      const bar = rbox(0.5, 0.03, 0.03, 0.012, MAT.metal("#2A2350")); place(bar, surf(0, 0.03, 0.06)); sk.add(bar);
    }
  } else {
    const box = rbox(0.86, 0.7, 0.62, 0.2, M.top); sk.add(box);
    const bez = rrPlane(0.72, 0.54, 0.17, M.dark); bez.position.z = 0.312; sk.add(bez);
    const face = makeBotFace(c.glow);
    const scr = rrPlane(0.66, 0.48, 0.14, new THREE.MeshBasicMaterial({ map: face.tex, toneMapped: false })); scr.position.z = 0.315; sk.add(scr); R.face = face;
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 32), M.bottom); e.rotation.z = Math.PI / 2; e.position.x = 0.45 * s; sk.add(e);
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.016, 8, 28), M.glow); r.rotation.y = Math.PI / 2; r.position.x = 0.492 * s; sk.add(r);
    });
    if (c.hat !== "catears") {
      const an = new THREE.Group(); an.position.y = 0.35; sk.add(an);
      const st = cap(0.014, 0.13, M.bottom); st.position.y = 0.08; an.add(st); an.add(sph(0.05, M.glow, 0, 0.2, 0));
      spring(an, 70);
    }
  }
  buildHat(sk, c, M, R, spring, bot);
  buildBack(torso, c, M, R, spring);

  /* buddy */
  if (c.buddy) {
    const b = new THREE.Group(); b.position.set(0.62, 1.38, 0.1); root.add(b);
    const bm = MAT.vinyl(shadeHex(c.glow, 1)); const bd = sph(0.11, bm, 0, 0, 0, 32); bd.scale.set(1, 0.9, 1); b.add(bd);
    const db = MAT.basic("#1E1236");
    [-1, 1].forEach((s) => {
      const e = sph(0.017, db, 0.038 * s, 0.012, 0.094, 12); e.scale.set(1, 1.3, 0.5); b.add(e);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.07, 14), bm); ear.position.set(0.058 * s, 0.1, 0); ear.rotation.z = -0.45 * s; b.add(ear);
      const bl = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), new THREE.MeshBasicMaterial({ map: blushTex(), transparent: true, depthWrite: false, toneMapped: false })); bl.position.set(0.06 * s, -0.015, 0.09); b.add(bl);
    });
    R.buddy = b;
  }
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m.material && (m.material as THREE.Material).transparent)) o.castShadow = true;
  });
  return R;
}

export function buildHair(sk: THREE.Group, c: CharacterConfig, M: Mats, R: Rig, spring: SpringFn): void {
  const g = new THREE.Group(); sk.add(g); R.hair = g; const m = M.hair;
  const capM = (r: number, th: number, tilt: number) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 56, 28, 0, Math.PI * 2, 0, Math.PI * th), m); s.rotation.x = tilt; s.scale.set(1, 0.95, 0.98); return s; };
  const bangs = (n: number, spread: number, pitch: number, size: number, tilt = 0) => {
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
      const b = new THREE.Mesh(new THREE.SphereGeometry(size, 20, 14), m); place(b, surf(y, pitch, -0.015, 0.43, 0.405, 0.415));
      b.rotateZ(tilt * (y >= 0 ? -1 : 1)); b.scale.set(1, 1.5, 0.45); g.add(b);
    }
  };
  const tufts = (dirs: [number, number, number][], r: number, h: number) => {
    const up = new THREE.Vector3(0, 1, 0);
    dirs.forEach((v) => { const d = new THREE.Vector3(...v).normalize(); const t = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), m); t.position.copy(d.clone().multiplyScalar(0.41)); t.position.y *= 0.95; t.quaternion.setFromUnitVectors(up, d); g.add(t); });
  };
  const h = c.hair;
  if (h === "buzz") { g.add(capM(0.43, 0.47, -0.35)); return; }
  if (h === "curly") {
    g.add(capM(0.43, 0.5, -0.4));
    const geo = new THREE.SphereGeometry(0.105, 18, 12), N = 90;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      if (d.y < -0.25 || (d.z > 0.3 && d.y < 0.45)) continue;
      const b = new THREE.Mesh(geo, m); b.position.copy(d).multiplyScalar(0.44); b.position.y *= 0.96; g.add(b);
    }
    return;
  }
  g.add(capM(0.445, 0.52, -0.38));
  if (h === "messy") {
    bangs(4, 0.7, 0.36, 0.095, 0.25);
    tufts([[0, 1, 0.15], [0.45, 0.85, 0.1], [-0.45, 0.85, 0.15], [0.2, 0.8, -0.55], [-0.3, 0.75, -0.6], [0.7, 0.5, -0.2], [-0.7, 0.55, -0.15], [0, 0.6, -0.8]], 0.085, 0.2);
  }
  if (h === "spiky") {
    bangs(3, 0.5, 0.38, 0.09, 0.4);
    tufts([[0, 1, 0.1], [0.5, 0.85, 0.2], [-0.5, 0.85, 0.2], [0.3, 0.8, -0.5], [-0.3, 0.8, -0.5], [0, 0.7, 0.6], [0.8, 0.55, -0.1], [-0.8, 0.55, -0.1], [0, 0.55, -0.85], [0.55, 0.5, 0.55], [-0.55, 0.5, 0.55]], 0.1, 0.3);
  }
  if (h === "bob") {
    bangs(5, 0.95, 0.35, 0.1);
    [-1, 1].forEach((s) => { const v = cap(0.15, 0.22, m); v.position.set(0.34 * s, -0.08, -0.04); g.add(v); });
    const back = sph(0.42, m, 0, -0.05, -0.1, 40); back.scale.set(1.04, 0.82, 0.9); g.add(back);
  }
  if (h === "buns") {
    bangs(5, 0.9, 0.35, 0.095);
    [-1, 1].forEach((s) => {
      const bg = new THREE.Group(); bg.position.set(0.27 * s, 0.3, -0.05); g.add(bg);
      bg.add(sph(0.15, m, 0.03 * s, 0.1, 0, 32));
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.024, 10, 28), M.acc); tie.rotation.x = Math.PI / 2; tie.rotation.z = 0.4 * s; tie.position.y = 0.01; bg.add(tie);
      spring(bg, 50, 0.7);
    });
  }
  if (h === "pony") {
    bangs(4, 0.8, 0.36, 0.095, 0.15);
    const pg = new THREE.Group(); pg.position.set(0, 0.14, -0.4); g.add(pg);
    pg.add(sph(0.12, m, 0, -0.02, -0.03, 28), sph(0.11, m, 0, -0.15, -0.07, 28), sph(0.085, m, 0, -0.27, -0.07, 24));
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 24), M.acc); tie.position.set(0, 0.05, 0); tie.rotation.x = 0.9; pg.add(tie);
    spring(pg, 40);
  }
  if (h === "long") {
    bangs(5, 0.95, 0.35, 0.1);
    const dg = new THREE.Group(); dg.position.set(0, 0.02, -0.2); g.add(dg);
    const drape = cap(0.29, 0.34, m); drape.position.y = -0.32; drape.scale.set(1.25, 1, 0.5); dg.add(drape); spring(dg, 30, 0.6);
    [-1, 1].forEach((s) => { const l = cap(0.07, 0.28, m); l.position.set(0.37 * s, -0.16, 0.1); l.rotation.z = 0.08 * s; g.add(l); });
  }
}

export function buildHat(sk: THREE.Group, c: CharacterConfig, M: Mats, R: Rig, spring: SpringFn, bot: boolean): void {
  const h = c.hat;
  if (h === "beanie" && !bot) {
    const tg = new THREE.Group(); tg.rotation.x = -0.32; sk.add(tg);
    tg.add(new THREE.Mesh(new THREE.SphereGeometry(0.462, 56, 28, 0, Math.PI * 2, 0, Math.PI * 0.46), M.accF));
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.445, 0.058, 16, 64), MAT.fabric(shadeHex(c.accC, 0.82))); f.rotation.x = Math.PI / 2; f.position.y = 0.462 * Math.cos(Math.PI * 0.46); tg.add(f);
    const pp = new THREE.Group(); pp.position.y = 0.45; tg.add(pp); pp.add(sph(0.1, MAT.fabric("#F5F3FF"), 0, 0.05, 0, 28)); spring(pp, 60);
  }
  if (h === "cap" && !bot) {
    const tg = new THREE.Group(); tg.rotation.x = -0.2; sk.add(tg);
    tg.add(new THREE.Mesh(new THREE.SphereGeometry(0.458, 56, 28, 0, Math.PI * 2, 0, Math.PI * 0.44), M.acc));
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.026, 48), MAT.vinyl(shadeHex(c.accC, 0.8))); brim.scale.z = 1.1; brim.position.set(0, 0.09, 0.38); brim.rotation.x = 0.16; tg.add(brim);
    tg.add(sph(0.035, MAT.vinyl(shadeHex(c.accC, 0.8)), 0, 0.458, 0, 16));
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.06, 28), M.glow); place(badge, surf(0, 0.5, 0.02, 0.458, 0.458, 0.458)); tg.add(badge);
  }
  if (h === "catears") {
    const inner = MAT.vinyl("#FFB3CC");
    [-1, 1].forEach((s) => {
      const eg = new THREE.Group();
      if (bot) { eg.position.set(0.27 * s, 0.36, 0); eg.rotation.z = -0.35 * s; }
      else { const sf = surf(0.5 * s, 0.92, 0.0, 0.44, 0.42, 0.43); eg.position.copy(sf.p); eg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sf.n); }
      sk.add(eg);
      const o = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 28), bot ? M.top : M.acc); o.position.y = 0.08; eg.add(o);
      const i = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.14, 24), inner); i.position.set(0, 0.07, 0.05); eg.add(i);
    });
    if (!bot) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.445, 0.02, 8, 48, Math.PI), M.acc); band.rotation.x = -0.12; sk.add(band); }
  }
  if (h === "halo") {
    const hg = new THREE.Group(); R.haloY = bot ? 0.66 : 0.66; hg.position.y = R.haloY; sk.add(hg);
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.026, 12, 56), M.glow); t.rotation.x = Math.PI / 2; hg.add(t);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C(c.glow), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false })); sp.scale.set(0.9, 0.5, 1); hg.add(sp);
    R.halo = hg;
  }
  if (h === "headphones") {
    const hm = MAT.vinyl("#231D48"), x = bot ? 0.5 : 0.45;
    const band = new THREE.Mesh(new THREE.TorusGeometry(bot ? 0.5 : 0.47, 0.036, 12, 48, Math.PI), hm); band.rotation.x = -0.08; band.position.y = bot ? 0.02 : 0; sk.add(band);
    [-1, 1].forEach((s) => {
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.1, 32), hm); cp.rotation.z = Math.PI / 2; cp.position.set(x * s, -0.02, 0); sk.add(cp);
      const cu = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 10, 28), M.acc); cu.rotation.y = Math.PI / 2; cu.position.set((x - 0.045) * s, -0.02, 0); sk.add(cu);
      const gl = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 28), M.glow); gl.rotation.y = Math.PI / 2; gl.position.set((x + 0.052) * s, -0.02, 0); sk.add(gl);
    });
  }
}

export function buildBack(torso: THREE.Group, c: CharacterConfig, M: Mats, R: Rig, spring: SpringFn): void {
  const b = c.back;
  if (b === "backpack") {
    const p = rbox(0.36, 0.38, 0.17, 0.08, M.acc); p.position.set(0, 0.27, -0.28); torso.add(p);
    const pk = rbox(0.24, 0.14, 0.06, 0.04, MAT.vinyl(shadeHex(c.accC, 0.82))); pk.position.set(0, 0.18, -0.38); torso.add(pk);
    const tab = rrPlane(0.06, 0.04, 0.015, M.glow); tab.position.set(0, 0.23, -0.412); tab.rotation.y = Math.PI; torso.add(tab);
    [-1, 1].forEach((s) => { const st = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.025), MAT.vinyl(shadeHex(c.accC, 0.78))); st.position.set(0.11 * s, 0.3, 0.224); torso.add(st); });
  }
  if (b === "cape") {
    const cp = new THREE.Group(); cp.position.set(0, 0.46, -0.17); cp.rotation.x = 0.1; torso.add(cp);
    const geo = new THREE.PlaneGeometry(0.52, 0.64, 1, 8); geo.translate(0, -0.32, 0);
    cp.add(new THREE.Mesh(geo, phys(shadeHex(c.glow, 0.6), { roughness: 0.7, side: THREE.DoubleSide })));
    spring(cp, 30);
  }
  if (b === "wings") {
    const wm = MAT.vinyl("#F8F5FF");
    [-1, 1].forEach((s) => {
      const wg = new THREE.Group(); wg.position.set(0.07 * s, 0.34, -0.2); torso.add(wg);
      [[0.13, 0.04, 0.12], [0.23, 0.1, 0.1], [0.31, 0.17, 0.075]].forEach(([x, y, r]) => { const f = sph(r, wm, x * s, y, -0.03, 24); f.scale.set(1, 0.42, 0.14); f.rotation.z = 0.5 * s; wg.add(f); });
      R.wings.push({ g: wg, s });
    });
  }
  if (b === "jetpack") {
    const jm = MAT.metal("#D9DCF5");
    const top = rbox(0.26, 0.14, 0.1, 0.04, M.acc); top.position.set(0, 0.36, -0.25); torso.add(top);
    [-1, 1].forEach((s) => {
      const t = cap(0.065, 0.16, jm); t.position.set(0.09 * s, 0.26, -0.28); torso.add(t);
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.05, 24), MAT.dark()); n.position.set(0.09 * s, 0.15, -0.28); torso.add(n);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C(c.glow), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
      fl.position.set(0.09 * s, 0.05, -0.28); torso.add(fl); R.jets.push(fl);
    });
  }
}

/** The bits of actor state applyFace reads. */
export interface FaceState {
  R: Rig;
  expr: Expression;
  blink: boolean;
  look: { x: number; y: number };
}

/* face state per frame */
export function applyFace(a: FaceState, t: number): void {
  const R = a.R, e = a.expr;
  if (R.face) {
    const open = e === "talk" && Math.sin(t * 22) > 0;
    R.face.draw(e === "talk" ? "neutral" : e, a.blink && e !== "happy" && e !== "love", open);
    R.face.tex.offset.set(-a.look.x * 0.06, a.look.y * 0.05);
    return;
  }
  const mouth = R.mouth as MouthRig;
  const happy = e === "happy" || e === "love";
  R.eyes.forEach((m) => { m.visible = !happy; m.scale.y = 1.16 * (a.blink ? 0.08 : 1) * (e === "focus" ? 0.72 : 1) * (e === "surprised" ? 1.12 : 1); m.scale.x = e === "surprised" ? 1.08 : 1; });
  R.happy.forEach((m) => { m.visible = happy; });
  const talkOpen = e === "talk" && Math.sin(t * 22) > 0;
  const open = happy || talkOpen || e === "surprised";
  mouth.open.visible = open; mouth.open.scale.setScalar(e === "surprised" ? 0.7 : talkOpen ? 0.85 : 1);
  mouth.smile.visible = !open && mouth.base !== "cat"; mouth.cat.visible = !open && mouth.base === "cat";
  const by = e === "surprised" ? 0.1 : happy ? 0.05 : e === "focus" ? -0.04 : 0;
  R.brows.forEach((b, i) => { b.rotation.x = -0.25 - by; b.children[0].rotation.z = Math.PI / 2 + (i ? 1 : -1) * (e === "focus" ? -0.25 : 0.15); });
}

/** Dispose a built character: geometries, materials and its own bot-face texture. Shared cached textures are kept. */
export function disposeRig(R: Rig): void {
  disposeObj(R.root);
  if (R.face) R.face.tex.dispose();
}
