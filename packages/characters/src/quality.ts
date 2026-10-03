/*
 * Quality flags.
 *
 * Low-power mode (mobile, or <= 4 cores): pixel ratio capped at 1.5, no shadow
 * maps, and MeshPhysicalMaterial swapped for MeshStandardMaterial.
 *
 * Nothing here touches window/document at import time, so the package is safe
 * to import during SSR.
 */

/** True on touch-first devices, narrow screens (<= 880px), or with 4 or fewer CPU cores. */
export function isLowPowerDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const mm = typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
    if (mm && (mm("(pointer: coarse)").matches || mm("(max-width: 880px)").matches)) return true;
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;
    return typeof cores === "number" && cores > 0 && cores <= 4;
  } catch {
    return false;
  }
}

let lowPower: boolean | null = null;

/** Override the global quality flag (applies to stages and builds created afterwards). */
export function setLowPower(v: boolean): void {
  lowPower = v;
}

/** The global quality flag. Defaults to isLowPowerDevice(), evaluated on first call. */
export function getLowPower(): boolean {
  if (lowPower === null) lowPower = isLowPowerDevice();
  return lowPower;
}

/** True when the browser can create a WebGL context. False outside the browser. */
export function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const cv = document.createElement("canvas");
    const gl = (cv.getContext("webgl2") || cv.getContext("webgl") || cv.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/*
 * Build-time quality scope. The material factory (materials.ts) reads this while
 * a character, pedestal or power effect is being built, so a low-power stage
 * gets MeshStandardMaterial and the thumbnail renderer always gets the full look.
 */
let buildLow: boolean | null = null;

export function withQuality<T>(low: boolean, fn: () => T): T {
  const prev = buildLow;
  buildLow = low;
  try {
    return fn();
  } finally {
    buildLow = prev;
  }
}

/** Quality used by the material factory right now. Falls back to the global flag. */
export function buildIsLow(): boolean {
  return buildLow ?? getLowPower();
}
