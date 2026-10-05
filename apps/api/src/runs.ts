/*
 * POST /runs: a live AI run, paid in credits and streamed back as Server-Sent Events.
 *
 * At the start, in one database transaction: the price is worked out on the server (a studio run
 * costs RUN_COST_CR, an example agent its listed price), the runner's balance is debited with a
 * ledger entry and the Run is created as RUNNING. Then the AI answers. A failed run refunds the
 * runner in full and is marked REFUNDED (CLAUDE.md 5.3). Example agents and studio runs have no
 * creator to pay yet; creator payouts arrive with stored, published agents.
 *
 * Preview guard rails on top of credits: runs are capped per minute, per wallet per day and in
 * total per day, one run at a time per wallet, so the AI bill stays bounded.
 */
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { PreviewRunSchema, type SkillId } from "@orbis/shared";
import { allow, sessionAddress } from "./auth";
import type { Env } from "./env";
import { InsufficientCredits, ensureUser, toCr } from "./ledger";
import {
  admitRun,
  day,
  debitRun,
  executeRun,
  isRefusal,
  resolveTarget,
  type RunRef,
} from "./run-core";
import type { Store } from "./store";

export function runRoutes(
  app: FastifyInstance,
  env: Env,
  store: Store,
  db: PrismaClient,
  fetchImpl: typeof fetch,
): void {
  app.get("/runs/status", async (req) => {
    const address = await sessionAddress(store, req);
    const used = address
      ? Number((await store.get(`runs:${address}:${day()}`)) ?? 0)
      : 0;
    return {
      live: env.aiReady,
      signedIn: Boolean(address),
      perDay: env.RUNS_PER_WALLET_PER_DAY,
      usedToday: Math.min(used, env.RUNS_PER_WALLET_PER_DAY),
      studioCost: env.RUN_COST_CR,
      webSearch: env.ENABLE_WEB_SEARCH,
    };
  });

  app.post("/runs", async (req, reply) => {
    const address = await sessionAddress(store, req);
    if (!address)
      return reply
        .code(401)
        .send({
          error: "sign_in",
          message: "Connect your wallet and sign in to run live answers.",
        });

    const body = PreviewRunSchema.safeParse(req.body);
    if (!body.success)
      return reply
        .code(400)
        .send({
          error: "invalid",
          message: body.error.issues[0]?.message ?? "Invalid run.",
        });
    const r = body.data;

    // Who is answering, and what it costs. The browser never sets the price.
    const runner = await ensureUser(db, address, env.WELCOME_CREDITS);
    const ref: RunRef =
      r.source === "studio"
        ? { source: "studio", agent: r.agent }
        : r.source === "agent"
          ? { source: "agent", agentId: r.agentId }
          : { source: "example", exampleId: r.exampleId };
    const target = await resolveTarget(db, env, runner.id, ref, r.skillId);
    if (isRefusal(target))
      return reply
        .code(target.status)
        .send({ error: target.error, message: target.message });
    if (!env.aiReady)
      return reply
        .code(503)
        .send({
          error: "ai_offline",
          message: "Live answers are not switched on yet.",
        });

    if (
      !(await allow(store, `runs:${address}`, env.RATE_LIMIT_RUNS_PER_MIN, 60))
    ) {
      return reply
        .code(429)
        .send({
          error: "too_fast",
          message:
            "That is a lot of runs in a minute. Wait a moment and try again.",
        });
    }
    const lock = `lock:run:${address}`;
    if (
      !(await store.setNx(lock, "1", Math.ceil(env.AI_TIMEOUT_MS / 1000) + 10))
    ) {
      return reply
        .code(409)
        .send({
          error: "busy",
          message: "Your agent is still working on the last task.",
        });
    }
    const giveBack = await admitRun(store, env, address);
    if (isRefusal(giveBack)) {
      await store.del(lock);
      return reply
        .code(giveBack.status)
        .send({ error: giveBack.error, message: giveBack.message });
    }

    // Debit and create the run in one transaction.
    let debit: Awaited<ReturnType<typeof debitRun>>;
    try {
      debit = await debitRun(db, runner, target, r.skillId);
    } catch (err) {
      await giveBack();
      await store.del(lock);
      if (err instanceof InsufficientCredits) {
        return reply.code(402).send({
          error: "no_credits",
          balance: toCr(err.balance),
          message: `Not enough credits. This run costs ${target.price} CR and you have ${toCr(err.balance)} CR. Top-ups with USDG are coming soon.`,
        });
      }
      throw err;
    }
    const { run, balance, cost } = debit;

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
    const send = (data: object) =>
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    send({
      t: "start",
      runId: run.id,
      cost: target.price,
      balance: toCr(balance),
      rateable: Boolean(target.agentId),
    });
    const started = Date.now();
    try {
      const out = await executeRun(db, env, store, fetchImpl, {
        runId: run.id,
        runnerId: runner.id,
        cost,
        target,
        skillId: r.skillId as SkillId,
        task: r.task,
        history: r.history,
        signal: ctrl.signal,
        onDelta: (text) => send({ t: "delta", text }),
        onStatus: (text) => send({ t: "status", text }),
        warn: (msg, err) =>
          req.log.warn(
            { run: { id: run.id }, err: (err as Error)?.message },
            msg,
          ),
      });
      // Never log the task, the instructions or the answer.
      if (out.ok) {
        send({ t: "done", balance: toCr(balance) });
        req.log.info(
          {
            run: {
              id: run.id,
              wallet: address,
              source: target.source,
              skill: r.skillId,
              model: out.model,
              usage: out.usage,
              ms: Date.now() - started,
            },
          },
          "run done",
        );
      } else {
        await giveBack();
        req.log.warn(
          {
            run: {
              id: run.id,
              wallet: address,
              source: target.source,
              skill: r.skillId,
              status: out.status,
              aborted: out.aborted,
              ms: Date.now() - started,
            },
          },
          "run failed",
        );
        send({
          t: "error",
          balance: out.refunded === null ? null : toCr(out.refunded),
          message: out.aborted
            ? "The answer took too long. Your credits were refunded. Try again."
            : "The AI could not answer right now. Your credits were refunded. Try again in a moment.",
        });
      }
    } finally {
      clearTimeout(timer);
      await store.del(lock);
      reply.raw.end();
    }
  });
}
