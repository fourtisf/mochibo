"use client";
/** Autopilot on the client: list, create, change, run now, results inbox, and local-time helpers. */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { AutopilotCreate, AutopilotEvery, AutopilotResultView, AutopilotView } from "@orbis/shared";
import { refreshAccount } from "./account";
import { ApiError, api, useAuth } from "./auth";

interface State {
  autopilots: AutopilotView[];
  results: AutopilotResultView[];
  unread: number;
  max: number;
  loaded: boolean;
}
let state: State = { autopilots: [], results: [], unread: 0, max: 5, loaded: false };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};

export async function refreshAutopilots(): Promise<void> {
  try {
    const [a, r] = await Promise.all([
      api<{ autopilots: AutopilotView[]; unread: number; max: number }>("/autopilots"),
      api<{ results: AutopilotResultView[] }>("/autopilots/results"),
    ]);
    // A new result means a run was paid: update the credits shown in the nav too.
    const newest = r.results[0]?.id;
    if (state.loaded && newest && newest !== state.results[0]?.id) void refreshAccount();
    set({ autopilots: a.autopilots, unread: a.unread, max: a.max, results: r.results, loaded: true });
  } catch {
    /* signed out or offline: keep what we have */
  }
}

/** Shared autopilot state for the signed-in wallet (loaded once per sign-in). */
export function useAutopilots(): State {
  const auth = useAuth();
  const snap = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (auth.status === "authenticated") void refreshAutopilots();
    else if (auth.status === "unauthenticated") set({ autopilots: [], results: [], unread: 0, loaded: false });
  }, [auth.status, auth.address]);
  return snap;
}

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export async function createAutopilot(body: AutopilotCreate): Promise<string | null> {
  try {
    await api("/autopilots", { method: "POST", body: JSON.stringify(body) });
    await refreshAutopilots();
    return null;
  } catch (e) {
    return errorText(e, "Could not start the autopilot. Try again.");
  }
}

export async function updateAutopilot(id: string, patch: Partial<Pick<AutopilotView, "enabled" | "task" | "skillId" | "every" | "minute" | "weekday">>): Promise<string | null> {
  try {
    await api(`/autopilots/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await refreshAutopilots();
    return null;
  } catch (e) {
    return errorText(e, "Could not save the change.");
  }
}

export async function deleteAutopilot(id: string): Promise<string | null> {
  try {
    await api(`/autopilots/${id}`, { method: "DELETE" });
    await refreshAutopilots();
    return null;
  } catch (e) {
    return errorText(e, "Could not delete it.");
  }
}

export async function runAutopilotNow(id: string): Promise<string | null> {
  try {
    await api(`/autopilots/${id}/run`, { method: "POST" });
    await refreshAutopilots();
    return null;
  } catch (e) {
    return errorText(e, "Could not start a run.");
  }
}

export async function markResultsRead(): Promise<void> {
  if (!state.unread) return;
  set({ unread: 0, results: state.results.map((r) => ({ ...r, read: true })) });
  await api("/autopilots/results/read", { method: "POST" }).catch(() => undefined);
}

/** Refresh every 20 s while something is about to run, so a "Run now" result shows up by itself. */
export function useAutopilotPolling(active: boolean) {
  const { autopilots } = useAutopilots();
  const soon = autopilots.some((a) => a.nextRunAt && new Date(a.nextRunAt).getTime() - Date.now() < 3 * 60_000);
  const tick = useCallback(() => void refreshAutopilots(), []);
  useEffect(() => {
    if (!active || !soon) return;
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, [active, soon, tick]);
}

// ---- time: the API stores minutes after midnight UTC (and a UTC weekday); people pick local time ----

/** Local "HH:MM" (and local weekday 0-6) to the UTC minute and UTC weekday. */
export function toUtc(local: string, localWeekday: number | null, now = new Date()): { minute: number; weekday: number | null } {
  const [h, m] = local.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (localWeekday !== null) d.setDate(d.getDate() + ((localWeekday - d.getDay() + 7) % 7));
  return { minute: d.getUTCHours() * 60 + d.getUTCMinutes(), weekday: localWeekday === null ? null : d.getUTCDay() };
}

/** UTC minute (and weekday) back to the visitor's local "HH:MM" and local weekday. */
export function fromUtc(minute: number, weekday: number | null): { time: string; weekday: number | null } {
  // 2026-10-04 is a Sunday: put the time on the right UTC weekday, then read it locally.
  const d = new Date(Date.UTC(2026, 9, 4 + (weekday ?? 0), 0, minute));
  return { time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, weekday: weekday === null ? null : d.getDay() };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS = DAYS;

/** "Every day at 09:00", "Every Friday at 18:00", "Every 6 hours from 03:00". */
export function scheduleLabel(every: AutopilotEvery, minute: number, weekday: number | null): string {
  const l = fromUtc(minute, weekday);
  if (every === "weekly") return `Every ${DAYS[l.weekday ?? 0]} at ${l.time}`;
  if (every === "6h") return `Every 6 hours from ${l.time}`;
  return `Every day at ${l.time}`;
}

/** "today 09:00", "tomorrow 09:00", "Fri 18:00". */
export function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return `today ${time}`;
  if (days === 1) return `tomorrow ${time}`;
  if (days === -1) return `yesterday ${time}`;
  return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()}/${d.getMonth() + 1} ${time}`;
}
