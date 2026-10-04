/*
 * POST /runs: a live AI run, streamed back as Server-Sent Events.
 *
 * Preview rules (no credits ledger yet): the wallet must be signed in, and runs are capped per
 * minute, per wallet per day and in total per day so a leaked session or a bot cannot run up the
 * AI bill. A failed run gives the wallet its daily run back. Phase 3 adds the ledger (debit,
 * creator credit, refunds) inside a database transaction.
 */
import type { FastifyInstance } from "fastify";
import { PreviewRunSchema } from "@orbis/shared";
import { ProviderError, streamChat, systemPrompt } from "./ai";
import { allow, sessionAddress } from "./auth";
import type { Env } from "./env";
import type { Store } from "./store";

const day = () => new Date().toISOString().slice(0, 10);
const DAY_TTL = 26 * 3600;

export function runRoutes(app: FastifyInstance, env: Env, store: Store, fetchImpl: typeof fetch): void {
  app.get("/runs/status", async (req) => {
    const address = await sessionAddress(store, req);
    const used = address ? Number((await store.get(`runs:${address}:${day()}`)) ?? 0) : 0;
    return { live: env.aiReady, signedIn: Boolean(address), perDay: env.RUNS_PER_WALLET_PER_DAY, usedToday: Math.min(used, env.RUNS_PER_WALLET_PER_DAY) };
  });

  app.post("/runs", async (req, reply) => {
    const address = await sessionAddress(store, req);
    if (!address) return reply.code(401).send({ error: "sign_in", message: "Connect your wallet and sign in to run live answers." });

    const body = PreviewRunSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid", message: body.error.issues[0]?.message ?? "Invalid run." });
    if (!env.aiReady) return reply.code(503).send({ error: "ai_offline", message: "Live answers are not switched on yet." });

    if (!(await allow(store, `runs:${address}`, env.RATE_LIMIT_RUNS_PER_MIN, 60))) {
      return reply.code(429).send({ error: "too_fast", message: "That is a lot of runs in a minute. Wait a moment and try again." });
    }
    const lock = `lock:run:${address}`;
    if (!(await store.setNx(lock, "1", Math.ceil(env.AI_TIMEOUT_MS / 1000) + 10))) {
      return reply.code(409).send({ error: "busy", message: "Your agent is still working on the last task." });
    }
    const walletKey = `runs:${address}:${day()}`;
    const totalKey = `runs:total:${day()}`;
    const giveBack = async () => {
      await store.decr(walletKey);
      await store.decr(totalKey);
    };
    if ((await store.incr(walletKey, DAY_TTL)) > env.RUNS_PER_WALLET_PER_DAY) {
      await store.decr(walletKey);
      await store.del(lock);
      return reply.code(429).send({ error: "daily_limit", message: `You have used today's ${env.RUNS_PER_WALLET_PER_DAY} live runs. They reset at midnight UTC.` });
    }
    if ((await store.incr(totalKey, DAY_TTL)) > env.RUNS_PER_DAY_TOTAL) {
      await giveBack();
      await store.del(lock);
      return reply.code(503).send({ error: "paused", message: "Live answers are paused for today because of high demand. They come back at midnight UTC." });
    }

    const { agent, skillId, task } = body.data;
    const webSearch = env.ENABLE_WEB_SEARCH && skillId === "research";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), env.AI_TIMEOUT_MS);
    // Stop paying for tokens nobody will read.
    reply.raw.on("close", () => {
      if (!reply.raw.writableFinished) ctrl.abort();
    });

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (data: object) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    const started = Date.now();
    let chars = 0;
    try {
      const events = streamChat(env, { system: systemPrompt(agent, skillId, webSearch), user: task, webSearch, signal: ctrl.signal }, fetchImpl);
      for await (const ev of events) {
        if (ev.type === "delta") {
          chars += ev.text.length;
          send({ t: "delta", text: ev.text });
        } else {
          if (!chars) throw new ProviderError("Empty answer");
          send({ t: "done" });
          // Never log the task, the instructions or the answer.
          req.log.info({ run: { wallet: address, skill: skillId, model: ev.model, usage: ev.usage, ms: Date.now() - started } }, "run done");
        }
      }
    } catch (err) {
      await giveBack();
      const aborted = ctrl.signal.aborted;
      req.log.warn({ run: { wallet: address, skill: skillId, status: err instanceof ProviderError ? err.status : undefined, aborted, ms: Date.now() - started } }, "run failed");
      send({ t: "error", message: aborted ? "The answer took too long. Your run was not counted. Try again." : "The AI could not answer right now. Your run was not counted. Try again in a moment." });
    } finally {
      clearTimeout(timer);
      await store.del(lock);
      reply.raw.end();
    }
  });
}
