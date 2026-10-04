/*
 * Credits ledger. Balances are BigInt centi-credits (1 CR = 100). Every change writes an
 * append-only LedgerEntry with a unique idempotency key and the balance after the change, in the
 * same database transaction that updates the cached User.balance (CLAUDE.md 5.4).
 */
import { CENTI_PER_CREDIT } from "@orbis/shared";
import type { LedgerType, Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient;
export const CENTI = BigInt(CENTI_PER_CREDIT);
export const cr = (wholeCredits: number): bigint => BigInt(Math.round(wholeCredits * CENTI_PER_CREDIT));
/** Centi-credits to a CR number for JSON (two decimals at most; balances stay far below 2^53). */
export const toCr = (centi: bigint): number => Number(centi) / CENTI_PER_CREDIT;

export class InsufficientCredits extends Error {
  constructor(readonly balance: bigint) {
    super("Not enough credits");
  }
}

interface Change {
  userId: string;
  /** Signed centi-credits. */
  amount: bigint;
  type: LedgerType;
  key: string;
  refType?: string;
  refId?: string;
  memo?: string;
}

/**
 * Apply one balance change inside a transaction. A debit never takes the balance below zero
 * (InsufficientCredits). Replaying the same key returns the first entry without changing anything.
 */
export async function applyChange(tx: Tx, c: Change) {
  const seen = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: c.key } });
  if (seen) return seen;
  if (c.amount < 0n) {
    // Conditional update: atomic even with concurrent runs, and the row stays locked until commit.
    const n = await tx.user.updateMany({ where: { id: c.userId, balance: { gte: -c.amount } }, data: { balance: { increment: c.amount } } });
    if (n.count !== 1) {
      const u = await tx.user.findUniqueOrThrow({ where: { id: c.userId }, select: { balance: true } });
      throw new InsufficientCredits(u.balance);
    }
  } else {
    await tx.user.update({ where: { id: c.userId }, data: { balance: { increment: c.amount } } });
  }
  const { balance } = await tx.user.findUniqueOrThrow({ where: { id: c.userId }, select: { balance: true } });
  return tx.ledgerEntry.create({
    data: { userId: c.userId, type: c.type, amount: c.amount, balanceAfter: balance, idempotencyKey: c.key, refType: c.refType, refId: c.refId, memo: c.memo },
  });
}

/** Find or create the user for a wallet, granting the one-time welcome credits to new wallets. */
export async function ensureUser(db: PrismaClient, wallet: string, welcomeCr: number) {
  const user = await db.user.upsert({ where: { wallet }, create: { wallet }, update: {} });
  if (welcomeCr > 0) {
    // The key makes this once per wallet, even if two sign-ins race.
    await db
      .$transaction((tx) => applyChange(tx, { userId: user.id, amount: cr(welcomeCr), type: "WELCOME", key: `welcome:${wallet}`, memo: "Welcome credits" }))
      .catch((e: unknown) => {
        if ((e as { code?: string }).code !== "P2002") throw e; // unique key already used by the other sign-in
      });
  }
  return db.user.findUniqueOrThrow({ where: { id: user.id } });
}

/** Nightly check (CLAUDE.md 5.4): the cached balance must equal the sum of the ledger. Returns mismatches. */
export async function reconcile(db: PrismaClient): Promise<{ wallet: string; cached: bigint; ledger: bigint }[]> {
  const rows = await db.$queryRaw<{ wallet: string; cached: bigint; ledger: bigint }[]>`
    SELECT u.wallet, u.balance AS cached, COALESCE(SUM(l.amount), 0)::bigint AS ledger
    FROM "User" u LEFT JOIN "LedgerEntry" l ON l."userId" = u.id
    GROUP BY u.id HAVING u.balance <> COALESCE(SUM(l.amount), 0)`;
  return rows;
}
