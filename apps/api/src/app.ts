/* Fastify app factory. server.ts wires real dependencies; tests pass a memory store and a fake provider. */
import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { authRoutes, sessionAddress } from "./auth";
import type { Env } from "./env";
import { runRoutes } from "./runs";
import type { Store } from "./store";

export interface AppDeps {
  env: Env;
  store: Store;
  fetchImpl?: typeof fetch;
  logger?: boolean;
}

export function buildApp({ env, store, fetchImpl = fetch, logger = true }: AppDeps): FastifyInstance {
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
    if (req.headers.origin !== env.appOrigin) return reply.code(403).send({ error: "forbidden", message: "Requests must come from the Mochibo site." });
  });

  app.get("/health", async () => ({ ok: true }));
  app.get("/me", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const address = await sessionAddress(store, req);
    return { address };
  });
  authRoutes(app, env, store);
  runRoutes(app, env, store, fetchImpl);
  return app;
}
