"use client";
/** Live landing-page numbers from the API (GET /stats, GET /leaderboard), fetched once per page view. */
import { useEffect, useState } from "react";
import { api } from "./auth";

export interface Stats {
  agents: number;
  runs: number;
  paidToCreators: number;
  recent: { agent: { name: string; slug: string; baseId: string; thumbnailUrl: string | null }; skillId: string; earned: number; at: string }[];
}
export interface Leaderboard {
  creators: { wallet: string; earned: number; runs: number; topAgent: { name: string; slug: string; baseId: string; thumbnailUrl: string | null } | null }[];
}

const cache = new Map<string, Promise<unknown>>();
function useApi<T>(path: string): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    if (!cache.has(path)) cache.set(path, api<T>(path).catch(() => null));
    (cache.get(path) as Promise<T | null>).then((r) => live && setV(r));
    return () => {
      live = false;
    };
  }, [path]);
  return v;
}

export const useStats = () => useApi<Stats>("/stats");
export const useLeaderboard = () => useApi<Leaderboard>("/leaderboard");
