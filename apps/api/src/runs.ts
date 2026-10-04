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
import { EXAMPLE_BY_ID, PreviewRunSchema, TIERS, type Persona, type SkillId } from "@orbis/shared";
import { toneFromDb } from "./agents";
import { ProviderError, streamChat, systemPrompt } from "./ai";
import { findLinks, readLinks, withLinks } from "./links";
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
    return { live: env.aiReady, signedIn: Boolean(address), perDay: env.RUNS_PER_WALLET_PER_DAY, usedToday: Math.min(used, env.RUNS_PER_WALLET_PER_DAY), studioCost: env.RUN_COST_CR, webSearch: env.ENABLE_WEB_SEARCH };
  });

  app.post("/runs", async (req, reply) => {
    const address = await sessionAddress(store, req);
    if (!address) return reply.code(401).send({ error: "sign_in", message: "Connect your wallet and sign in to run live answers." });

    const body = PreviewRunSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid", message: body.error.issues[0]?.message ?? "Invalid run." });
    const r = body.data;

    // Who is answering, and what it costs. The browser never sets the price.
    let persona: Persona, price: number, source: string;
    /** Set when a stored agent runs: its id and the creator to pay (null for your own agent). */
    let agentId: string | null = null;
    let creatorId: string | null = null;
    const runner = await ensureUser(db, address, env.WELCOME_CREDITS);
    if (r.source === "studio") {
      persona = r.agent;
      price = env.RUN_COST_CR;
      source = "studio";
    } else if (r.source === "agent") {
      const a = await db.agent.findFirst({ where: { id: r.agentId, deletedAt: null, OR: [{ published: true }, { ownerId: runner.id }] } });
      if (!a) return reply.code(404).send({ error: "not_found", message: "That agent does not exist or is not published." });
      persona = { name: a.name, instructions: a.instructions, tone: toneFromDb(a.tone), lang: "English", skills: a.skills as SkillId[] };
      agentId = a.id;
      source = "agent";
      // Running your own agent costs a studio run and pays nobody; anyone else pays its price.
      if (a.ownerId === runner.id) price = env.RUN_COST_CR;
      else {
        price = a.price;
        creatorId = a.ownerId;
      }
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
      const user = runner;
      ({ run, balance } = await db.$transaction(async (tx) => {
        const created = await tx.run.create({ data: { runnerId: user.id, agentId, source, skillId: r.skillId, status: "RUNNING", cost } });
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
    send({ t: "start", runId: run.id, cost: price, balance: toCr(balance), rateable: Boolean(agentId) });
    const started = Date.now();
    let chars = 0;
    try {
      // Links in the task: read the pages first so the agent can work from them.
      let userMessage = r.task;
      const linkCount = findLinks(r.task).length;
      if (linkCount) {
        send({ t: "status", text: linkCount === 1 ? "Reading the link…" : `Reading ${linkCount} links…` });
        userMessage = withLinks(r.task, await readLinks(r.task, { allowPrivate: env.NODE_ENV === "test" && env.UNSAFE_ALLOW_PRIVATE_LINKS }));
      }
      const events = streamChat(env, { system: systemPrompt(persona, r.skillId, webSearch), user: userMessage, history: r.history, webSearch, signal: ctrl.signal }, fetchImpl);
      for await (const ev of events) {
        if (ev.type === "delta") {
          chars += ev.text.length;
          send({ t: "delta", text: ev.text });
        } else {
          if (!chars) throw new ProviderError("Empty answer");
          // Done: pay the creator the price minus the platform fee for their tier (CLAUDE.md 5.3, 5.8).
          await db.$transaction(async (tx) => {
            let creatorNet = 0n;
            let fee = 0n;
            if (creatorId && cost > 0n) {
              const creator = await tx.user.findUniqueOrThrow({ where: { id: creatorId }, select: { tier: true } });
              const feeBps = BigInt((TIERS.find((t) => t.id === creator.tier) ?? TIERS[0]).feeBps);
              fee = (cost * feeBps) / 10_000n;
              creatorNet = cost - fee;
              await applyChange(tx, { userId: creatorId, amount: creatorNet, type: "RUN_CREDIT", key: `run:${run.id}:credit`, refType: "run", refId: run.id, memo: `Earned: ${persona.name}` });
            }
            await tx.run.update({
              where: { id: run.id },
              data: { status: "DONE", model: ev.model, tokensIn: ev.usage?.promptTokens, tokensOut: ev.usage?.completionTokens, finishedAt: new Date(), creatorNet, fee },
            });
            if (agentId) await tx.agent.update({ where: { id: agentId }, data: { runsCount: { increment: 1 }, earnedTotal: { increment: creatorNet } } });
          });
          // Level points: one per other wallet per agent per UTC day, so one wallet cannot farm levels.
          // The run is already paid and done here, so a failure only skips the point.
          if (agentId && creatorId) {
            const id = agentId;
            const day = new Date().toISOString().slice(0, 10);
            await store
              .setNx(`xp:${id}:${runner.id}:${day}`, "1", 2 * 86400)
              .then(async (first) => {
                if (first) await db.agent.update({ where: { id }, data: { xp: { increment: 1 } } });
              })
              .catch((e: unknown) => req.log.warn({ err: (e as Error).message }, "xp not added"));
          }
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
