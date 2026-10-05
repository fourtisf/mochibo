/*
 * The money and AI core of one run, shared by POST /runs (streamed to the browser) and Autopilot
 * (scheduled, no browser). Kept in one place so both pay, credit and refund exactly the same way:
 *
 *   resolveTarget  who answers and what it costs (the server sets the price, never the browser)
 *   admitRun       daily limits per wallet and in total (the AI bill stays bounded)
 *   debitRun       one transaction: create the Run as RUNNING and debit the runner (RUN_DEBIT)
 *   executeRun     read links, stream the AI answer, then either pay the creator the price minus
 *                  the tier fee (RUN_CREDIT) and mark DONE, or refund in full (REFUND)
 */
import type { PrismaClient } from "@prisma/client";
import {
  EXAMPLE_BY_ID,
  TIERS,
  type Persona,
  type SkillId,
} from "@orbis/shared";
import { toneFromDb } from "./agents";
import { ProviderError, streamChat, systemPrompt, type Usage } from "./ai";
import type { Env } from "./env";
import { applyChange, cr } from "./ledger";
import { findLinks, readLinks, withLinks } from "./links";
import type { Store } from "./store";

export const day = () => new Date().toISOString().slice(0, 10);
const DAY_TTL = 26 * 3600;

export type RunRef =
  | { source: "studio"; agent: Persona }
  | { source: "agent"; agentId: string }
  | { source: "example"; exampleId: string };

export interface RunTarget {
  persona: Persona;
  /** Whole CR. */
  price: number;
  source: string;
  /** Set when a stored agent runs. */
  agentId: string | null;
  /** The creator to pay: null for your own agent, studio runs and examples. */
  creatorId: string | null;
}

export interface Refusal {
  status: number;
  error: string;
  message: string;
}

export async function resolveTarget(
  db: PrismaClient,
  env: Env,
  runnerId: string,
  ref: RunRef,
  skillId: string,
): Promise<RunTarget | Refusal> {
  let t: RunTarget;
  if (ref.source === "studio") {
    t = {
      persona: ref.agent,
      price: env.RUN_COST_CR,
      source: "studio",
      agentId: null,
      creatorId: null,
    };
  } else if (ref.source === "agent") {
    const a = await db.agent.findFirst({
      where: {
        id: ref.agentId,
        deletedAt: null,
        OR: [{ published: true }, { ownerId: runnerId }],
      },
    });
    if (!a)
      return {
        status: 404,
        error: "not_found",
        message: "That agent does not exist or is not published.",
      };
    const own = a.ownerId === runnerId;
    // Running your own agent costs a studio run and pays nobody; anyone else pays its price.
    t = {
      persona: {
        name: a.name,
        instructions: a.instructions,
        tone: toneFromDb(a.tone),
        lang: "English",
        skills: a.skills as SkillId[],
      },
      price: own ? env.RUN_COST_CR : a.price,
      source: "agent",
      agentId: a.id,
      creatorId: own ? null : a.ownerId,
    };
  } else {
    const ex = EXAMPLE_BY_ID[ref.exampleId];
    if (!ex)
      return {
        status: 404,
        error: "not_found",
        message: "That agent does not exist.",
      };
    t = {
      persona: {
        name: ex.name,
        instructions: ex.desc,
        tone: "Friendly",
        lang: "English",
        skills: ex.skills,
      },
      price: ex.price,
      source: `example:${ex.id}`,
      agentId: null,
      creatorId: null,
    };
  }
  if (!t.persona.skills.includes(skillId as SkillId))
    return {
      status: 400,
      error: "invalid",
      message: "That skill is not equipped.",
    };
  return t;
}

export const isRefusal = (x: unknown): x is Refusal =>
  typeof x === "object" && x !== null && "status" in x && "error" in x;

/** Count the run against today's limits. Returns a function that gives the slot back, or a refusal. */
export async function admitRun(
  store: Store,
  env: Env,
  address: string,
): Promise<(() => Promise<void>) | Refusal> {
  const walletKey = `runs:${address}:${day()}`;
  const totalKey = `runs:total:${day()}`;
  if ((await store.incr(walletKey, DAY_TTL)) > env.RUNS_PER_WALLET_PER_DAY) {
    await store.decr(walletKey);
    return {
      status: 429,
      error: "daily_limit",
      message: `You have used today's ${env.RUNS_PER_WALLET_PER_DAY} live runs. They reset at midnight UTC.`,
    };
  }
  if ((await store.incr(totalKey, DAY_TTL)) > env.RUNS_PER_DAY_TOTAL) {
    await store.decr(walletKey);
    await store.decr(totalKey);
    return {
      status: 503,
      error: "paused",
      message:
        "Live answers are paused for today because of high demand. They come back at midnight UTC.",
    };
  }
  return async () => {
    await store.decr(walletKey);
    await store.decr(totalKey);
  };
}

/** Create the Run and debit the runner in one transaction. Throws InsufficientCredits. */
export async function debitRun(
  db: PrismaClient,
  runner: { id: string; balance: bigint },
  t: RunTarget,
  skillId: string,
) {
  const cost = cr(t.price);
  const { run, balance } = await db.$transaction(async (tx) => {
    const created = await tx.run.create({
      data: {
        runnerId: runner.id,
        agentId: t.agentId,
        source: t.source,
        skillId,
        status: "RUNNING",
        cost,
      },
    });
    const entry =
      cost > 0n
        ? await applyChange(tx, {
            userId: runner.id,
            amount: -cost,
            type: "RUN_DEBIT",
            key: `run:${created.id}:debit`,
            refType: "run",
            refId: created.id,
            memo: `Ran ${t.persona.name}`,
          })
        : null;
    return {
      run: created,
      balance: entry ? entry.balanceAfter : runner.balance,
    };
  });
  return { run, balance, cost };
}

export type RunOutcome =
  | { ok: true; text: string; model: string; usage: Usage | null }
  | {
      ok: false;
      aborted: boolean;
      status?: number;
      /** Balance after the refund, or null if the refund itself failed. */ refunded:
        | bigint
        | null;
    };

interface ExecuteArgs {
  runId: string;
  runnerId: string;
  cost: bigint;
  target: RunTarget;
  skillId: SkillId;
  task: string;
  history?: { task: string; answer: string }[];
  signal: AbortSignal;
  onDelta?: (text: string) => void;
  onStatus?: (text: string) => void;
  /** Called with errors that do not change the outcome (xp, refund failures). */
  warn?: (msg: string, err: unknown) => void;
}

export async function executeRun(
  db: PrismaClient,
  env: Env,
  store: Store,
  fetchImpl: typeof fetch,
  a: ExecuteArgs,
): Promise<RunOutcome> {
  const { target: t, runId, cost } = a;
  const webSearch = env.ENABLE_WEB_SEARCH && a.skillId === "research";
  let text = "";
  try {
    // Links in the task: read the pages first so the agent can work from them.
    let userMessage = a.task;
    const linkCount = findLinks(a.task).length;
    if (linkCount) {
      a.onStatus?.(
        linkCount === 1 ? "Reading the link…" : `Reading ${linkCount} links…`,
      );
      userMessage = withLinks(
        a.task,
        await readLinks(a.task, {
          allowPrivate:
            env.NODE_ENV === "test" && env.UNSAFE_ALLOW_PRIVATE_LINKS,
        }),
      );
    }
    const events = streamChat(
      env,
      {
        system: systemPrompt(t.persona, a.skillId, webSearch),
        user: userMessage,
        history: a.history,
        webSearch,
        signal: a.signal,
      },
      fetchImpl,
    );
    for await (const ev of events) {
      if (ev.type === "delta") {
        text += ev.text;
        a.onDelta?.(ev.text);
        continue;
      }
      if (!text) throw new ProviderError("Empty answer");
      // Done: pay the creator the price minus the platform fee for their tier (CLAUDE.md 5.3, 5.8).
      await db.$transaction(async (tx) => {
        let creatorNet = 0n;
        let fee = 0n;
        if (t.creatorId && cost > 0n) {
          const creator = await tx.user.findUniqueOrThrow({
            where: { id: t.creatorId },
            select: { tier: true },
          });
          const feeBps = BigInt(
            (TIERS.find((x) => x.id === creator.tier) ?? TIERS[0]).feeBps,
          );
          fee = (cost * feeBps) / 10_000n;
          creatorNet = cost - fee;
          await applyChange(tx, {
            userId: t.creatorId,
            amount: creatorNet,
            type: "RUN_CREDIT",
            key: `run:${runId}:credit`,
            refType: "run",
            refId: runId,
            memo: `Earned: ${t.persona.name}`,
          });
        }
        await tx.run.update({
          where: { id: runId },
          data: {
            status: "DONE",
            model: ev.model,
            tokensIn: ev.usage?.promptTokens,
            tokensOut: ev.usage?.completionTokens,
            finishedAt: new Date(),
            creatorNet,
            fee,
          },
        });
        if (t.agentId)
          await tx.agent.update({
            where: { id: t.agentId },
            data: {
              runsCount: { increment: 1 },
              earnedTotal: { increment: creatorNet },
            },
          });
      });
      // Level points: one per other wallet per agent per UTC day, so one wallet cannot farm levels.
      // The run is already paid and done here, so a failure only skips the point.
      if (t.agentId && t.creatorId) {
        const id = t.agentId;
        await store
          .setNx(`xp:${id}:${a.runnerId}:${day()}`, "1", 2 * 86400)
          .then(async (first) => {
            if (first)
              await db.agent.update({
                where: { id },
                data: { xp: { increment: 1 } },
              });
          })
          .catch((e: unknown) => a.warn?.("xp not added", e));
      }
      return { ok: true, text, model: ev.model, usage: ev.usage };
    }
    throw new ProviderError("The answer was cut off");
  } catch (err) {
    const aborted = a.signal.aborted;
    const status = err instanceof ProviderError ? err.status : undefined;
    // Full refund; the creator gets nothing for a failed run.
    const refunded = await db
      .$transaction(async (tx) => {
        await tx.run.update({
          where: { id: runId },
          data: {
            status: "REFUNDED",
            error: aborted
              ? "aborted"
              : `provider${status ? ` ${status}` : ""}`,
            finishedAt: new Date(),
          },
        });
        if (cost === 0n)
          return (
            await tx.user.findUniqueOrThrow({
              where: { id: a.runnerId },
              select: { balance: true },
            })
          ).balance;
        const e = await applyChange(tx, {
          userId: a.runnerId,
          amount: cost,
          type: "REFUND",
          key: `run:${runId}:refund`,
          refType: "run",
          refId: runId,
          memo: `Refund: ${t.persona.name}`,
        });
        return e.balanceAfter;
      })
      .catch((e: unknown) => {
        a.warn?.("refund failed", e);
        return null;
      });
    return { ok: false, aborted, status, refunded };
  }
}
