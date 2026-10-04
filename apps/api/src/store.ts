/*
 * Small key-value store for nonces, sessions and rate limits. Redis in production; an in-memory
 * version for development and tests (single process only, data is lost on restart).
 */
import { Redis } from "ioredis";

export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  /** Set only if the key does not exist. Returns true when it was set. */
  setNx(key: string, value: string, ttlSec: number): Promise<boolean>;
  /** Read and delete in one step. */
  take(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  /** Increment a counter; the TTL is set when the counter is created. Returns the new value. */
  incr(key: string, ttlSec: number): Promise<number>;
  decr(key: string): Promise<void>;
  close(): Promise<void>;
}

export function redisStore(url: string): Store {
  const r = new Redis(url, { maxRetriesPerRequest: 2 });
  return {
    get: (k) => r.get(k),
    async set(k, v, ttl) {
      await r.set(k, v, "EX", ttl);
    },
    async setNx(k, v, ttl) {
      return (await r.set(k, v, "EX", ttl, "NX")) === "OK";
    },
    take: (k) => r.getdel(k),
    async del(k) {
      await r.del(k);
    },
    async incr(k, ttl) {
      const [[, n]] = (await r.multi().incr(k).expire(k, ttl, "NX").exec()) as [[null, number], unknown];
      return n;
    },
    async decr(k) {
      await r.decr(k);
    },
    async close() {
      await r.quit();
    },
  };
}

export function memoryStore(now: () => number = Date.now): Store {
  const m = new Map<string, { v: string; exp: number }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (e && e.exp <= now()) m.delete(k);
    return m.get(k);
  };
  return {
    async get(k) {
      return live(k)?.v ?? null;
    },
    async set(k, v, ttl) {
      m.set(k, { v, exp: now() + ttl * 1000 });
    },
    async setNx(k, v, ttl) {
      if (live(k)) return false;
      m.set(k, { v, exp: now() + ttl * 1000 });
      return true;
    },
    async take(k) {
      const v = live(k)?.v ?? null;
      m.delete(k);
      return v;
    },
    async del(k) {
      m.delete(k);
    },
    async incr(k, ttl) {
      const e = live(k);
      const n = (e ? Number(e.v) : 0) + 1;
      m.set(k, { v: String(n), exp: e ? e.exp : now() + ttl * 1000 });
      return n;
    },
    async decr(k) {
      const e = live(k);
      if (e) e.v = String(Number(e.v) - 1);
    },
    async close() {
      m.clear();
    },
  };
}
