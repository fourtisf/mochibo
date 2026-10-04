import type { BattleView, PublicAgent } from "@orbis/shared";

/** Server-side calls to our API (share pages, embeds). PM2 sets API_INTERNAL_URL to the API's local port. */
const API = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";

export async function getPublicAgent(slug: string): Promise<PublicAgent | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  try {
    const res = await fetch(`${API}/a/${slug}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return ((await res.json()) as { agent: PublicAgent }).agent;
  } catch {
    return null;
  }
}

export async function getPublicBattle(slug: string): Promise<BattleView | null> {
  if (!/^[a-z0-9]{1,20}$/.test(slug)) return null;
  try {
    const res = await fetch(`${API}/battles/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { battle: BattleView }).battle;
  } catch {
    return null;
  }
}
