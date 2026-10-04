"use client";
/**
 * The signed-in wallet's credits: balance and recent ledger entries, read from the API
 * (GET /me and /me/ledger). Credits live on the server; the browser only displays them.
 */
import { useSyncExternalStore } from "react";
import { api, onAuthChange } from "./auth";

export interface LedgerItem {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  memo: string | null;
  createdAt: string;
}

interface AccountState {
  /** CR, or null when signed out or not loaded yet. */
  balance: number | null;
  ledger: LedgerItem[];
}

let state: AccountState = { balance: null, ledger: [] };
const subs = new Set<() => void>();
const set = (patch: Partial<AccountState>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};

let inflight: Promise<void> | null = null;
/** Reload balance and ledger from the API (calls made while one is running share it). */
export function refreshAccount(): Promise<void> {
  inflight ??= Promise.all([api<{ balance: number | null }>("/me"), api<{ entries: LedgerItem[] }>("/me/ledger").catch(() => ({ entries: [] }))])
    .then(([me, l]) => set({ balance: me.balance, ledger: me.balance === null ? [] : l.entries }))
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Runs report the new balance as they go, so the pill updates without a round trip. */
export function setBalance(balance: number) {
  set({ balance });
}

if (typeof window !== "undefined") {
  onAuthChange((a) => {
    if (a.status === "authenticated") void refreshAccount();
    else set({ balance: null, ledger: [] });
  });
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
}
