import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CHARACTERS, type CharacterConfig } from "@orbis/shared";

type BuilderModule = typeof import("./builder");
type TexturesModule = typeof import("./textures");

/** A 2D context that accepts every call and property write. */
function fakeContext2D(): CanvasRenderingContext2D {
  const gradient = () => ({ addColorStop() {} });
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_t, prop) {
      if (prop === "createRadialGradient" || prop === "createLinearGradient") return gradient;
      return () => {};
    },
    set() {
      return true;
    },
  });
}

function installFakeDocument(): void {
  const ctx = fakeContext2D();
  const doc = {
    createElement(tag: string) {
      if (tag !== "canvas") throw new Error("unexpected element " + tag);
      return { width: 0, height: 0, getContext: (kind: string) => (kind === "2d" ? ctx : null) };
    },
  };
  (globalThis as unknown as { document: unknown }).document = doc;
}

let B: BuilderModule;
let T: TexturesModule;

beforeAll(async () => {
  installFakeDocument();
  B = await import("./builder");
  T = await import("./textures");
});

function materialsOf(root: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = [];
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (m) out.push(...([] as THREE.Material[]).concat(m));
  });
  return out;
}

function geometriesOf(root: THREE.Object3D): Set<THREE.BufferGeometry> {
  const out = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    const n = o as THREE.Mesh & { isSprite?: boolean };
    if (n.geometry && !n.isSprite) out.add(n.geometry);
  });
  return out;
}

const byId = (id: string): CharacterConfig => {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error("missing " + id);
  return c.config;
};

describe("buildCharacter", () => {
  it("builds all 12 base characters", () => {
    expect(CHARACTERS).toHaveLength(12);
    for (const c of CHARACTERS) {
      const R = B.buildCharacter(c.config, { lowPower: false });
      expect(R.root.children.length).toBeGreaterThan(0);
      expect(R.arms).toHaveLength(2);
      expect(R.head).toBeInstanceOf(THREE.Group);
      expect(R.cfg.kind).toBe(c.config.kind);
      B.disposeRig(R);
    }
  });

  it("gives bots an LED face and no hair, and humans hair and eyes", () => {
    for (const c of CHARACTERS) {
      const R = B.buildCharacter(c.config, { lowPower: false });
      if (c.config.kind === "bot") {
        expect(R.hair).toBeUndefined();
        expect(R.face).toBeDefined();
        expect(R.eyes).toHaveLength(0);
      } else {
        expect(R.hair).toBeInstanceOf(THREE.Group);
        expect(R.face).toBeUndefined();
        expect(R.eyes).toHaveLength(2);
      }
      B.disposeRig(R);
    }
  });

  it("uses MeshPhysicalMaterial at full quality and none in low-power mode", () => {
    for (const c of CHARACTERS) {
      const full = B.buildCharacter(c.config, { lowPower: false });
      expect(materialsOf(full.root).some((m) => m instanceof THREE.MeshPhysicalMaterial)).toBe(true);
      B.disposeRig(full);

      const low = B.buildCharacter(c.config, { lowPower: true });
      const mats = materialsOf(low.root);
      expect(mats.some((m) => m instanceof THREE.MeshPhysicalMaterial)).toBe(false);
      expect(mats.some((m) => m.type === "MeshPhysicalMaterial")).toBe(false);
      expect(mats.some((m) => m instanceof THREE.MeshStandardMaterial)).toBe(true);
      B.disposeRig(low);
    }
    // Round glasses (physical lens) and a cape (physical with side) in low-power mode.
    const kofi = B.buildCharacter({ ...byId("kofi"), back: "cape" }, { lowPower: true });
    expect(materialsOf(kofi.root).some((m) => m instanceof THREE.MeshPhysicalMaterial)).toBe(false);
    B.disposeRig(kofi);
  });

  it("disposes geometries but never the shared cached textures", () => {
    const geoSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const texSpy = vi.spyOn(THREE.Texture.prototype, "dispose");
    try {
      // Juni: eyes, blush, emblem, buddy. Pip: hover flame sprite. Sora: halo sprite. Gizmo: jetpack sprites.
      for (const id of ["juni", "pip", "sora", "gizmo", "tessa"]) {
        geoSpy.mockClear();
        texSpy.mockClear();
        const R = B.buildCharacter(byId(id), { lowPower: false });
        const geos = geometriesOf(R.root);
        expect(geos.size).toBeGreaterThan(0);
        B.disposeRig(R);

        const disposedGeos = new Set(geoSpy.mock.contexts);
        for (const g of geos) expect(disposedGeos.has(g)).toBe(true);

        const shared = new Set<THREE.Texture>(Object.values(T.TEX));
        expect(shared.size).toBeGreaterThan(0);
        for (const t of texSpy.mock.contexts) expect(shared.has(t as THREE.Texture)).toBe(false);
        if (R.face) expect(texSpy.mock.contexts).toContain(R.face.tex);
        else expect(texSpy).not.toHaveBeenCalled();
      }
      for (const k of ["glow", "blush", "eye" + byId("juni").eyeC, "emb" + byId("juni").glow]) expect(T.TEX[k]).toBeDefined();
    } finally {
      geoSpy.mockRestore();
      texSpy.mockRestore();
    }
  });
});

describe("applyFace", () => {
  it("drives human expressions and bot screens", () => {
    const human = B.buildCharacter(byId("juni"), { lowPower: false });
    B.applyFace({ R: human, expr: "happy", blink: false, look: { x: 0, y: 0 } }, 0);
    expect(human.eyes.every((e) => !e.visible)).toBe(true);
    expect(human.mouth?.open.visible).toBe(true);
    B.applyFace({ R: human, expr: "neutral", blink: true, look: { x: 0, y: 0 } }, 0);
    expect(human.eyes[0].scale.y).toBeCloseTo(1.16 * 0.08);
    B.disposeRig(human);

    const bot = B.buildCharacter(byId("pip"), { lowPower: false });
    B.applyFace({ R: bot, expr: "love", blink: false, look: { x: 0.5, y: 0.2 } }, 0);
    expect(bot.face?.key).toBe("love|false|false");
    expect(bot.face?.tex.offset.x).toBeCloseTo(-0.03);
    B.disposeRig(bot);
  });
});
