/* THUMBNAILS (prototype thumbFor): one shared offscreen renderer, always full quality. */
import * as THREE from "three";
import { normalizeCharacter, type CharacterConfig } from "@orbis/shared";
import { buildCharacter, disposeRig } from "./builder";
import { makeEnv } from "./environment";
import { C } from "./materials";

interface ThumbRenderer {
  r: THREE.WebGLRenderer;
  s: THREE.Scene;
  env: THREE.WebGLRenderTarget;
  cam: THREE.PerspectiveCamera;
  camF: THREE.PerspectiveCamera;
}

export interface ThumbnailOptions {
  /** Full body (320x400) instead of the head-and-shoulders portrait (320x360). */
  full?: boolean;
  type?: "image/png" | "image/webp";
  /** Encoder quality for image/webp (0 to 1). */
  quality?: number;
}

let TR: ThumbRenderer | null = null;
const THUMB_CACHE = new Map<string, string>();

function makeThumbRenderer(): ThumbRenderer {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(320, 360); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const s = new THREE.Scene(); const env = makeEnv(r); s.environment = env.texture;
  s.add(new THREE.HemisphereLight(0xcfc6ff, 0x1a1440, 0.35));
  const k = new THREE.DirectionalLight(0xffffff, 1.45); k.position.set(2.5, 5.5, 4); s.add(k);
  const rm = new THREE.DirectionalLight(C("#9BE8FF"), 1.1); rm.position.set(-4, 3, -4); s.add(rm);
  const rm2 = new THREE.DirectionalLight(C("#FF9FCB"), 0.7); rm2.position.set(4, 2, -3); s.add(rm2);
  const cam = new THREE.PerspectiveCamera(24, 320 / 360, 0.1, 30); cam.position.set(0, 1.36, 3.75); cam.lookAt(0, 1.27, 0);
  const camF = new THREE.PerspectiveCamera(24, 320 / 400, 0.1, 30); camF.position.set(0, 1.02, 5.1); camF.lookAt(0, 1.0, 0);
  return { r, s, env, cam, camF };
}

/**
 * Render a character to a data URL (prototype thumbFor). Portrait is 320x360,
 * full body 320x400, transparent background. Results are cached per
 * type + full + config. Returns "" when rendering fails (for example, no WebGL).
 */
export function renderThumbnail(config: CharacterConfig, opts: ThumbnailOptions = {}): string {
  const full = !!opts.full, type = opts.type ?? "image/png";
  const cfg = normalizeCharacter(config);
  const key = type + (full ? "F" : "P") + (opts.quality ?? "") + JSON.stringify(cfg);
  const hit = THUMB_CACHE.get(key);
  if (hit) return hit;
  try {
    if (!TR) TR = makeThumbRenderer();
    TR.r.setSize(320, full ? 400 : 360);
    const R = buildCharacter(cfg, { lowPower: false });
    R.root.rotation.y = full ? 0.28 : 0.32; R.head.rotation.y = -0.16;
    if (R.buddy) R.buddy.position.set(0.52, 1.5, 0.1);
    let url: string;
    try {
      TR.s.add(R.root); TR.r.render(TR.s, full ? TR.camF : TR.cam);
      url = TR.r.domElement.toDataURL(type, opts.quality);
    } finally {
      TR.s.remove(R.root); disposeRig(R);
    }
    if (!url.startsWith("data:image/")) return "";
    THUMB_CACHE.set(key, url);
    return url;
  } catch {
    return "";
  }
}

/** Free the shared thumbnail renderer and its WebGL context. Cached data URLs are kept. */
export function disposeThumbnailRenderer(): void {
  if (!TR) return;
  const t = TR;
  TR = null;
  t.s.environment = null;
  t.env.dispose();
  t.r.dispose();
  t.r.forceContextLoss();
}
