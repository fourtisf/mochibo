"use client";
/**
 * Sign-in state shared between the wallet button (which loads lazily in the nav) and the rest of
 * the page. The session itself is an httpOnly cookie set by the API; this only mirrors whether one
 * exists. The wallet button registers openSignIn() so a Run click can open the connect modal.
 */
import { useSyncExternalStore } from "react";

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";
interface AuthState {
  status: AuthStatus;
  address: string | null;
}

let state: AuthState = { status: "loading", address: null };
let opener: (() => void) | null = null;
const subs = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  subs.forEach((f) => f());
}

export const API_BASE = "/api";

/** JSON request to our API. Same-origin, so the session cookie and Origin header go along. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    // A JSON content type with an empty body is rejected by the API, so writes always send one.
    body: init?.body ?? (init?.method && init.method !== "GET" ? "{}" : undefined),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

let loaded: Promise<void> | null = null;
/** Read the current session once (on first use). */
export function loadSession(): Promise<void> {
  loaded ??= api<{ address: string | null }>("/me")
    .then((r) => set(r.address ? { status: "authenticated", address: r.address } : { status: "unauthenticated", address: null }))
    .catch(() => set({ status: "unauthenticated", address: null }));
  return loaded;
}

export const authActions = {
  signedIn(address: string) {
    set({ status: "authenticated", address });
  },
  signedOut() {
    set({ status: "unauthenticated", address: null });
  },
  registerOpener(fn: (() => void) | null) {
    opener = fn;
  },
  /** Opens the wallet modal (connect, then sign in). Returns false if the wallet button is not ready yet. */
  openSignIn(): boolean {
    if (!opener) return false;
    opener();
    return true;
  },
};

export const getAuth = () => state;

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
}
