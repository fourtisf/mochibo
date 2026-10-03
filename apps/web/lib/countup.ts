import { fmt } from "./format";
import { isReducedMotion } from "./hooks";

/** Animate a number into an element (prototype countUp). Returns a cancel function. */
export function countUp(el: HTMLElement, to: number, dec: number, prefix = "", suffix = ""): () => void {
  if (isReducedMotion()) {
    el.textContent = prefix + (+to).toFixed(dec) + suffix;
    return () => {};
  }
  const t0 = performance.now();
  const dur = 1400;
  let raf = 0;
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    const v = to * e;
    el.textContent = prefix + (dec ? v.toFixed(dec) : fmt(Math.round(v))) + suffix;
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
