"use client";
/** Agent Battle on the client: start one (streamed), load one, vote, and the lists for the landing page. */
import { useEffect, useState } from "react";
import type { BattleLine, BattleStart, BattleView, Side } from "@orbis/shared";
import { refreshAccount, setBalance } from "./account";
import { API_BASE, ApiError, api } from "./auth";

export interface BattleStatus {
  live: boolean;
  costCr: number;
  prizeCr: number;
  perDay: number;
  usedToday: number;
}

export function useBattleStatus(refresh = 0): BattleStatus | null {
  const [s, setS] = useState<BattleStatus | null>(null);
  useEffect(() => {
    api<BattleStatus>("/battles/status")
      .then(setS)
      .catch(() => undefined);
  }, [refresh]);
  return s;
}

export function useBattles(refresh = 0): BattleView[] {
  const [list, setList] = useState<BattleView[]>([]);
  useEffect(() => {
    api<{ battles: BattleView[] }>("/battles")
      .then((r) => setList(r.battles))
      .catch(() => undefined);
  }, [refresh]);
  return list;
}

export interface TopFighter {
  name: string;
  slug: string;
  baseId: string;
  thumbnailUrl: string | null;
  battleWins: number;
  xp: number;
}

export function useTopFighters(): TopFighter[] {
  const [list, setList] = useState<TopFighter[]>([]);
  useEffect(() => {
    api<{ fighters: TopFighter[] }>("/battles/top")
      .then((r) => setList(r.fighters))
      .catch(() => undefined);
  }, []);
  return list;
}

export const getBattle = (slug: string) => api<{ battle: BattleView }>(`/battles/${encodeURIComponent(slug)}`).then((r) => r.battle);

/** Vote; returns the updated battle or a readable error. */
export async function voteBattle(slug: string, side: Side): Promise<BattleView | string> {
  try {
    return (await api<{ battle: BattleView }>(`/battles/${encodeURIComponent(slug)}/vote`, { method: "POST", body: JSON.stringify({ side }) })).battle;
  } catch (e) {
    return e instanceof ApiError ? e.message : "Could not save your vote.";
  }
}

export interface LiveHandlers {
  onStart(slug: string): void;
  /** A line is being written (side), then its text grows. */
  onLine(side: Side): void;
  onLineEnd(line: BattleLine): void;
  onDone(battle: BattleView): void;
  onError(message: string): void;
}

/** POST /battles and follow its stream. */
export async function startBattle(body: BattleStart, h: LiveHandlers, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/battles`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch {
    return h.onError("Could not reach Mochibo. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => null)) as { message?: string; balance?: number } | null;
    if (typeof err?.balance === "number") setBalance(err.balance);
    return h.onError(err?.message || "Could not start the battle. Try again in a moment.");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let sep: number;
      while ((sep = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, sep).trim();
        buf = buf.slice(sep + 2);
        if (!raw.startsWith("data:")) continue;
        const ev = JSON.parse(raw.slice(5)) as
          | { t: "start"; slug: string; balance: number }
          | { t: "line"; side: Side }
          | { t: "delta"; text: string }
          | { t: "lineEnd"; side: Side; text: string }
          | { t: "done"; battle: BattleView }
          | { t: "error"; message: string; balance: number | null };
        if (ev.t === "start") {
          setBalance(ev.balance);
          h.onStart(ev.slug);
        } else if (ev.t === "line") h.onLine(ev.side);
        else if (ev.t === "lineEnd") h.onLineEnd({ side: ev.side, text: ev.text });
        else if (ev.t === "done") {
          finished = true;
          h.onDone(ev.battle);
        } else if (ev.t === "error") {
          finished = true;
          if (ev.balance !== null) setBalance(ev.balance);
          h.onError(ev.message);
        }
      }
    }
  } catch {
    if (!signal?.aborted && !finished) h.onError("The connection dropped. The battle keeps going: open it from the list in a moment.");
    return;
  } finally {
    void refreshAccount();
  }
  if (!finished) h.onError("The connection dropped. The battle keeps going: open it from the list in a moment.");
}

/** "23h 10m left", "12m left", "Voting closed". */
export function timeLeft(endsAt: string | null, now = Date.now()): string {
  if (!endsAt) return "";
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Voting closed";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h ? `${h}h ${m}m left to vote` : `${Math.max(1, m)}m left to vote`;
}
