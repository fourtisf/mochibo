/* Fastify app factory. server.ts wires real dependencies; tests pass a memory store and a fake provider. */
import cookie from "@fastify/cookie";
import type { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyInstance } from "fastify";
import { agentRoutes } from "./agents";
import { authRoutes, sessionAddress } from "./auth";
import type { Env } from "./env";
import { toCr } from "./ledger";
import { runRoutes } from "./runs";
import type { Store } from "./store";

export interface AppDeps {
  env: Env;
  store: Store;
  db: PrismaClient;
  fetchImpl?: typeof fetch;
  logger?: boolean;
}

export function buildApp({ env, store, db, fetchImpl = fetch, logger = true }: AppDeps): FastifyInstance {
  const app = Fastify({
    // Nginx on the same machine sets X-Forwarded-For; trust only that hop.
    trustProxy: "127.0.0.1",
    bodyLimit: 64 * 1024,
    logger: logger
      ? {
          level: env.NODE_ENV === "production" ? "info" : "debug",
          // Request logs carry method, path and status only: no bodies, cookies or headers.
          serializers: { req: (r) => ({ method: r.method, url: r.url }), res: (r) => ({ statusCode: r.statusCode }) },
        }
      : false,
  });
  app.register(cookie);

  // CSRF: every state-changing request must come from the site itself.
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
    if (!env.appOrigins.includes(req.headers.origin ?? "")) return reply.code(403).send({ error: "forbidden", message: "Requests must come from the Mochibo site." });
  });

  // Health: the API process, PostgreSQL and Redis must all answer.
  app.get("/health", async (_req, reply) => {
    const db_ = await db.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const redis = await store.get("health").then(() => true).catch(() => false);
    const ok = db_ && redis;
    return reply.code(ok ? 200 : 503).send({ ok, db: db_, redis });
  });
  app.get("/me", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const address = await sessionAddress(store, req);
    if (!address) return { address: null, balance: null };
    const user = await db.user.findUnique({ where: { wallet: address }, select: { balance: true, tier: true } });
    return { address, balance: user ? toCr(user.balance) : 0, tier: user?.tier ?? "FREE" };
  });
  app.get("/me/ledger", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const address = await sessionAddress(store, req);
    if (!address) return reply.code(401).send({ error: "sign_in", message: "Sign in to see your credits." });
    const q = req.query as { before?: string };
    const before = q.before && !Number.isNaN(Date.parse(q.before)) ? new Date(q.before) : null;
    const entries = await db.ledgerEntry.findMany({
      where: { user: { wallet: address }, ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, amount: true, balanceAfter: true, memo: true, createdAt: true },
    });
    return { entries: entries.map((e) => ({ ...e, amount: toCr(e.amount), balanceAfter: toCr(e.balanceAfter) })) };
  });
  authRoutes(app, env, store, db);
  agentRoutes(app, env, store, db);
  runRoutes(app, env, store, db, fetchImpl);
  return app;
}
