/*
 * Autopilot: an agent runs a task on a schedule and the result goes to the owner's inbox.
 *
 * The scheduler runs inside the API process every minute (like battle settling). It claims a due
 * autopilot with a conditional update of nextRunAt, so a run can never start twice, then runs it
 * through the same core as POST /runs (run-core.ts): same daily limits, same debit, same creator
 * payout, same full refund on failure. Out of credits, a missing agent or three failures in a row
 * pause the autopilot with a reason the owner sees. Tasks and results are private to the owner.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Autopilot, AutopilotEvery as DbEvery, PrismaClient } from "@prisma/client";
import {
  AUTOPILOT,
  AutopilotCreateSchema,
  AutopilotPatchSchema,
  nextRunAfter,
  type AutopilotEvery,
  type AutopilotResultView,
  type AutopilotView,
  type SkillId,
} from "@orbis/shared";
import { allow, sessionAddress } from "./auth";
import type { Env } from "./env";
import { InsufficientCredits, ensureUser, toCr } from "./ledger";
import { admitRun, debitRun, executeRun, isRefusal, resolveTarget, type RunRef } from "./run-core";
import type { Store } from "./store";

const EVERY_TO_DB: Record<AutopilotEvery, DbEvery> = { "6h": "HOURS6", daily: "DAILY", weekly: "WEEKLY" };
const EVERY_FROM_DB: Record<DbEvery, AutopilotEvery> = { HOURS6: "6h", DAILY: "daily", WEEKLY: "weekly" };

export function autopilotView(a: Autopilot): AutopilotView {
  return {
    id: a.id,
    name: a.name,
    agentId: a.agentId,
    exampleId: a.exampleId,
    skillId: a.skillId,
    task: a.task,
    every: EVERY_FROM_DB[a.every],
    minute: a.minute,
    weekday: a.weekday,
    enabled: a.enabled,
    pausedReason: a.pausedReason,
    nextRunAt: a.enabled && a.nextRunAt ? a.nextRunAt.toISOString() : null,
    lastRunAt: a.lastRunAt?.toISOString() ?? null,
    lastStatus: (a.lastStatus as AutopilotView["lastStatus"]) ?? null,
  };
}

const refOf = (a: Pick<Autopilot, "agentId" | "exampleId">): RunRef => (a.agentId ? { source: "agent", agentId: a.agentId } : { source: "example", exampleId: a.exampleId ?? "" });
const next = (a: Pick<Autopilot, "every" | "minute" | "weekday">, from: Date) => nextRunAfter(EVERY_FROM_DB[a.every], a.minute, a.weekday, from);

/** Run every autopilot that is due. Returns how many it ran. Safe to call from several places at once. */
export async function runDueAutopilots(db: PrismaClient, env: Env, store: Store, fetchImpl: typeof fetch, log: { warn(o: object, m: string): void }, now = new Date()): Promise<number> {
  if (!env.aiReady) return 0;
  const due = await db.autopilot.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, orderBy: { nextRunAt: "asc" }, take: 10, include: { owner: { select: { id: true, wallet: true, balance: true } } } });
  let ran = 0;
  for (const ap of due) {
    // Claim it: move nextRunAt on only if nobody else did.
    const claimed = await db.autopilot.updateMany({ where: { id: ap.id, enabled: true, nextRunAt: ap.nextRunAt }, data: { nextRunAt: next(ap, now) } });
    if (!claimed.count) continue;
    ran++;
    await runOne(db, env, store, fetchImpl, log, ap, ap.owner).catch((e: unknown) => log.warn({ autopilot: ap.id, err: (e as Error).message }, "autopilot run crashed"));
  }
  return ran;
}

async function runOne(db: PrismaClient, env: Env, store: Store, fetchImpl: typeof fetch, log: { warn(o: object, m: string): void }, ap: Autopilot, owner: { id: string; wallet: string; balance: bigint }) {
  const result = async (status: "done" | "failed" | "skipped" | "paused", text: string, runId: string | null, pause?: string, failures?: number) => {
    await db.$transaction(async (tx) => {
      await tx.autopilotResult.create({ data: { autopilotId: ap.id, ownerId: owner.id, runId, status, text } });
      await tx.autopilot.update({
        where: { id: ap.id },
        data: { lastRunAt: new Date(), lastStatus: status, ...(failures !== undefined ? { failures } : {}), ...(pause ? { enabled: false, pausedReason: pause } : {}) },
      });
      // Keep the inbox small: drop the oldest results of this autopilot.
      const old = await tx.autopilotResult.findMany({ where: { autopilotId: ap.id }, orderBy: { createdAt: "desc" }, skip: AUTOPILOT.keepResults, select: { id: true } });
      if (old.length) await tx.autopilotResult.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    });
  };

  const target = await resolveTarget(db, env, owner.id, refOf(ap), ap.skillId);
  if (isRefusal(target)) return result("paused", `Paused: ${target.message}`, null, target.message);

  const giveBack = await admitRun(store, env, owner.wallet);
  if (isRefusal(giveBack)) return result("skipped", `Skipped this run: ${giveBack.message}`, null);

  let debit: Awaited<ReturnType<typeof debitRun>>;
  try {
    debit = await debitRun(db, owner, target, ap.skillId);
  } catch (err) {
    await giveBack();
    if (err instanceof InsufficientCredits) {
      const msg = `Out of credits: a run costs ${target.price} CR and you have ${toCr(err.balance)} CR.`;
      return result("paused", `Paused. ${msg}`, null, msg);
    }
    throw err;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.AI_TIMEOUT_MS);
  try {
    const out = await executeRun(db, env, store, fetchImpl, {
      runId: debit.run.id,
      runnerId: owner.id,
      cost: debit.cost,
      target,
      skillId: ap.skillId as SkillId,
      task: ap.task,
      signal: ctrl.signal,
      warn: (msg, e) => log.warn({ autopilot: ap.id, err: (e as Error)?.message }, msg),
    });
    if (out.ok) return result("done", out.text, debit.run.id, undefined, 0);
    await giveBack();
    const failures = ap.failures + 1;
    const pause = failures >= AUTOPILOT.maxFailures ? `Paused after ${failures} failed runs in a row. Turn it back on to try again.` : undefined;
    return result("failed", `The AI could not answer this time. Your ${target.price} CR were refunded.${pause ? ` ${pause}` : ""}`, debit.run.id, pause, failures);
  } finally {
    clearTimeout(timer);
  }
}

export function autopilotRoutes(app: FastifyInstance, env: Env, store: Store, db: PrismaClient, fetchImpl: typeof fetch): void {
  let busy = false;
  const tick = async () => {
    if (busy) return; // one batch at a time in this process
    busy = true;
    try {
      await runDueAutopilots(db, env, store, fetchImpl, app.log);
    } catch (e) {
      app.log.warn({ err: (e as Error).message }, "autopilot tick failed");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));

  async function me(req: FastifyRequest, reply: FastifyReply) {
    const wallet = await sessionAddress(store, req);
    if (!wallet) {
      reply.code(401).send({ error: "sign_in", message: "Connect your wallet and sign in first." });
      return null;
    }
    return ensureUser(db, wallet, env.WELCOME_CREDITS);
  }
  async function mine(req: FastifyRequest, reply: FastifyReply) {
    const user = await me(req, reply);
    if (!user) return null;
    const { id } = req.params as { id: string };
    const ap = await db.autopilot.findFirst({ where: { id: String(id).slice(0, 40), ownerId: user.id } });
    if (!ap) {
      reply.code(404).send({ error: "not_found", message: "Autopilot not found." });
      return null;
    }
    return { user, ap };
  }
  const noStore = (reply: FastifyReply) => reply.header("Cache-Control", "no-store");

  app.get("/autopilots", async (req, reply) => {
    noStore(reply);
    const user = await me(req, reply);
    if (!user) return;
    const [list, unread] = await Promise.all([db.autopilot.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } }), db.autopilotResult.count({ where: { ownerId: user.id, read: false } })]);
    return { autopilots: list.map(autopilotView), unread, max: AUTOPILOT.maxPerWallet, live: env.aiReady };
  });

  app.post("/autopilots", async (req, reply) => {
    const user = await me(req, reply);
    if (!user) return;
    if (!(await allow(store, `autopilots:save:${user.id}`, 30, 3600))) return reply.code(429).send({ error: "too_fast", message: "Too many changes. Try again later." });
    const body = AutopilotCreateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid", message: body.error.issues[0]?.message ?? "Invalid autopilot." });
    const d = body.data;
    if ((await db.autopilot.count({ where: { ownerId: user.id } })) >= AUTOPILOT.maxPerWallet) {
      return reply.code(400).send({ error: "invalid", message: `You can have up to ${AUTOPILOT.maxPerWallet} autopilots. Delete one to make room.` });
    }
    const ref: RunRef = d.target.kind === "agent" ? { source: "agent", agentId: d.target.id } : { source: "example", exampleId: d.target.id };
    const target = await resolveTarget(db, env, user.id, ref, d.skillId);
    if (isRefusal(target)) return reply.code(target.status).send({ error: target.error, message: target.message });
    const schedule = { every: EVERY_TO_DB[d.every], minute: d.minute, weekday: d.every === "weekly" ? d.weekday : null };
    const ap = await db.autopilot.create({
      data: {
        ownerId: user.id,
        agentId: target.agentId,
        exampleId: d.target.kind === "example" ? d.target.id : null,
        name: target.persona.name.slice(0, 32),
        skillId: d.skillId,
        task: d.task,
        ...schedule,
        nextRunAt: next(schedule, new Date()),
      },
    });
    return reply.code(201).send({ autopilot: autopilotView(ap), cost: target.price });
  });

  app.patch("/autopilots/:id", async (req, reply) => {
    const found = await mine(req, reply);
    if (!found) return;
    if (!(await allow(store, `autopilots:save:${found.user.id}`, 30, 3600))) return reply.code(429).send({ error: "too_fast", message: "Too many changes. Try again later." });
    const body = AutopilotPatchSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid", message: body.error.issues[0]?.message ?? "Invalid change." });
    const d = body.data;
    const merged = {
      every: d.every ? EVERY_TO_DB[d.every] : found.ap.every,
      minute: d.minute ?? found.ap.minute,
      weekday: d.weekday !== undefined ? d.weekday : found.ap.weekday,
      skillId: d.skillId ?? found.ap.skillId,
    };
    if (merged.every === "WEEKLY" && merged.weekday === null) return reply.code(400).send({ error: "invalid", message: "Pick a day for a weekly autopilot." });
    if (merged.every !== "WEEKLY") merged.weekday = null;
    const enabled = d.enabled ?? found.ap.enabled;
    if (enabled) {
      // Turning on (or changing the skill) checks that the agent can still run it.
      const target = await resolveTarget(db, env, found.user.id, refOf(found.ap), merged.skillId);
      if (isRefusal(target)) return reply.code(target.status).send({ error: target.error, message: target.message });
    }
    const ap = await db.autopilot.update({
      where: { id: found.ap.id },
      data: {
        ...merged,
        ...(d.task !== undefined ? { task: d.task } : {}),
        enabled,
        // Back on, or a new time: start fresh from now.
        ...(enabled ? { pausedReason: null, failures: d.enabled ? 0 : found.ap.failures, nextRunAt: next(merged, new Date()) } : {}),
      },
    });
    return { autopilot: autopilotView(ap) };
  });

  app.delete("/autopilots/:id", async (req, reply) => {
    const found = await mine(req, reply);
    if (!found) return;
    await db.autopilot.delete({ where: { id: found.ap.id } });
    return { ok: true };
  });

  /** Run now: the scheduler picks it up within a minute. */
  app.post("/autopilots/:id/run", async (req, reply) => {
    const found = await mine(req, reply);
    if (!found) return;
    if (!found.ap.enabled) return reply.code(409).send({ error: "paused", message: "Turn the autopilot on first." });
    if (!(await allow(store, `autopilots:now:${found.ap.id}`, 1, 600))) return reply.code(429).send({ error: "too_fast", message: "This autopilot already ran in the last 10 minutes." });
    const ap = await db.autopilot.update({ where: { id: found.ap.id }, data: { nextRunAt: new Date() } });
    return { autopilot: autopilotView(ap) };
  });

  app.get("/autopilots/results", async (req, reply) => {
    noStore(reply);
    const user = await me(req, reply);
    if (!user) return;
    const q = req.query as { cursor?: string; autopilot?: string };
    const rows = await db.autopilotResult.findMany({
      where: { ownerId: user.id, ...(q.autopilot ? { autopilotId: String(q.autopilot).slice(0, 40) } : {}) },
      orderBy: { createdAt: "desc" },
      take: 21,
      ...(q.cursor ? { cursor: { id: String(q.cursor).slice(0, 40) }, skip: 1 } : {}),
      include: { autopilot: { select: { name: true, task: true } } },
    });
    const page = rows.slice(0, 20);
    const results: AutopilotResultView[] = page.map((r) => ({ id: r.id, autopilotId: r.autopilotId, name: r.autopilot.name, task: r.autopilot.task, status: r.status as AutopilotResultView["status"], text: r.text, read: r.read, createdAt: r.createdAt.toISOString() }));
    return { results, next: rows.length > 20 ? page[page.length - 1].id : null };
  });

  app.post("/autopilots/results/read", async (req, reply) => {
    const user = await me(req, reply);
    if (!user) return;
    await db.autopilotResult.updateMany({ where: { ownerId: user.id, read: false }, data: { read: true } });
    return { ok: true };
  });
}
