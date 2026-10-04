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
import { EXAMPLE_BY_ID, PreviewRunSchema, type Persona, type SkillId } from "@orbis/shared";
import { ProviderError, streamChat, systemPrompt } from "./ai";
import { allow, sessionAddress } from "./auth";
import type { Env } from "./env";
import { InsufficientCredits, applyChange, cr, ensureUser, toCr } from "./ledger";
import type { Store } from "./store";

const day = () => new Date().toISOString().slice(0, 10);
const DAY_TTL = 26 * 3600;

export function runRoutes(app: FastifyInstance, env: Env, store: Store, db: PrismaClient, fetchImpl: typeof fetch): void {
  app.get("/runs/status", async (req) => {
    const address = await sessionAddress(store, req);
    const used = address ? Number((await store.get(`runs:${address}:${day()}`)) ?? 0) : 0;
    return { live: env.aiReady, signedIn: Boolean(address), perDay: env.RUNS_PER_WALLET_PER_DAY, usedToday: Math.min(used, env.RUNS_PER_WALLET_PER_DAY), studioCost: env.RUN_COST_CR };
  });

  app.post("/runs", async (req, reply) => {
    const address = await sessionAddress(store, req);
    if (!address) return reply.code(401).send({ error: "sign_in", message: "Connect your wallet and sign in to run live answers." });

    const body = PreviewRunSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid", message: body.error.issues[0]?.message ?? "Invalid run." });
    const r = body.data;

    // Who is answering, and what it costs. The browser never sets the price.
    let persona: Persona, price: number, source: string;
    if (r.source === "studio") {
      persona = r.agent;
      price = env.RUN_COST_CR;
      source = "studio";
    } else {
      const ex = EXAMPLE_BY_ID[r.exampleId];
      if (!ex) return reply.code(404).send({ error: "not_found", message: "That agent does not exist." });
      persona = { name: ex.name, instructions: ex.desc, tone: "Friendly", lang: "English", skills: ex.skills };
      price = ex.price;
      source = `example:${ex.id}`;
    }
    if (!persona.skills.includes(r.skillId as SkillId)) return reply.code(400).send({ error: "invalid", message: "That skill is not equipped." });
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

    // Debit and create the run in one transaction.
    const cost = cr(price);
    let run: { id: string };
    let balance: bigint;
    try {
      const user = await ensureUser(db, address, env.WELCOME_CREDITS);
      ({ run, balance } = await db.$transaction(async (tx) => {
        const created = await tx.run.create({ data: { runnerId: user.id, source, skillId: r.skillId, status: "RUNNING", cost } });
        const entry =
          cost > 0n
            ? await applyChange(tx, { userId: user.id, amount: -cost, type: "RUN_DEBIT", key: `run:${created.id}:debit`, refType: "run", refId: created.id, memo: `Ran ${persona.name}` })
            : null;
        return { run: created, balance: entry ? entry.balanceAfter : user.balance };
      }));
    } catch (err) {
      await giveBack();
      await store.del(lock);
      if (err instanceof InsufficientCredits) {
        return reply.code(402).send({
          error: "no_credits",
          balance: toCr(err.balance),
          message: `Not enough credits. This run costs ${price} CR and you have ${toCr(err.balance)} CR. Top-ups with USDG are coming soon.`,
        });
      }
      throw err;
    }

    const webSearch = env.ENABLE_WEB_SEARCH && r.skillId === "research";
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
    send({ t: "start", cost: price, balance: toCr(balance) });
    const started = Date.now();
    let chars = 0;
    try {
      const events = streamChat(env, { system: systemPrompt(persona, r.skillId, webSearch), user: r.task, webSearch, signal: ctrl.signal }, fetchImpl);
      for await (const ev of events) {
        if (ev.type === "delta") {
          chars += ev.text.length;
          send({ t: "delta", text: ev.text });
        } else {
          if (!chars) throw new ProviderError("Empty answer");
          await db.run.update({
            where: { id: run.id },
            data: { status: "DONE", model: ev.model, tokensIn: ev.usage?.promptTokens, tokensOut: ev.usage?.completionTokens, finishedAt: new Date() },
          });
          send({ t: "done", balance: toCr(balance) });
          // Never log the task, the instructions or the answer.
          req.log.info({ run: { id: run.id, wallet: address, source, skill: r.skillId, model: ev.model, usage: ev.usage, ms: Date.now() - started } }, "run done");
        }
      }
    } catch (err) {
      await giveBack();
      const aborted = ctrl.signal.aborted;
      const status = err instanceof ProviderError ? err.status : undefined;
      // Full refund; the creator (none yet) gets nothing.
      const refunded = await db
        .$transaction(async (tx) => {
          await tx.run.update({ where: { id: run.id }, data: { status: "REFUNDED", error: aborted ? "aborted" : `provider${status ? ` ${status}` : ""}`, finishedAt: new Date() } });
          if (cost === 0n) return balance;
          const user = await tx.run.findUniqueOrThrow({ where: { id: run.id }, select: { runnerId: true } });
          const e = await applyChange(tx, { userId: user.runnerId, amount: cost, type: "REFUND", key: `run:${run.id}:refund`, refType: "run", refId: run.id, memo: `Refund: ${persona.name}` });
          return e.balanceAfter;
        })
        .catch((e: unknown) => {
          req.log.error({ run: { id: run.id }, err: e }, "refund failed");
          return null;
        });
      req.log.warn({ run: { id: run.id, wallet: address, source, skill: r.skillId, status, aborted, ms: Date.now() - started } }, "run failed");
      send({
        t: "error",
        balance: refunded === null ? null : toCr(refunded),
        message: aborted ? "The answer took too long. Your credits were refunded. Try again." : "The AI could not answer right now. Your credits were refunded. Try again in a moment.",
      });
    } finally {
      clearTimeout(timer);
      await store.del(lock);
      reply.raw.end();
    }
  });
}
