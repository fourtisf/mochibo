/*
 * Shared render loop (from boot() in the prototype): one requestAnimationFrame
 * loop updates every live stage. It starts with the first stage and stops when
 * the last one is disposed.
 */

export interface Tickable {
  update(dt: number): void;
}

const live: Tickable[] = [];
let raf = 0;
let last = 0;

function frame(now: number): void {
  const dt = Math.min(1 / 30, Math.max(0.001, (now - last) / 1000));
  last = now;
  // Copy: a stage may be disposed (and unregistered) while we iterate.
  live.slice().forEach((s) => s.update(dt));
  raf = live.length ? requestAnimationFrame(frame) : 0;
}

export function addToLoop(s: Tickable): void {
  if (!live.includes(s)) live.push(s);
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

export function removeFromLoop(s: Tickable): void {
  const i = live.indexOf(s);
  if (i >= 0) live.splice(i, 1);
  if (!live.length && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

/** Number of stages in the loop (for tests and diagnostics). */
export const loopSize = (): number => live.length;
