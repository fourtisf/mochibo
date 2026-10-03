export const fmt = (n: number) => Number(n).toLocaleString("en-US");
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/** SVG path for a sparkline, same math as the prototype. */
export function sparkPath(vals: readonly number[], w: number, h: number, pad = 3): string {
  const mx = Math.max(...vals);
  const mn = Math.min(...vals);
  return vals
    .map((v, i) => `${i ? "L" : "M"}${((i / (vals.length - 1)) * w).toFixed(1)} ${(h - pad - ((v - mn) / (mx - mn || 1)) * (h - pad * 2)).toFixed(1)}`)
    .join(" ");
}

/** Lowercase, dash-separated, ASCII only. Used for placeholder slugs until the API assigns real ones. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "agent"
  );
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
