/*
 * Nightly ledger check (CLAUDE.md 5.4): every cached User.balance must equal the sum of that
 * user's ledger entries. Prints the result; exits with code 1 on any mismatch so cron logs it
 * as a failure. Run from cron by deploy/api-setup.sh:
 *   node --env-file=/home/mochibo/api.env apps/api/dist/reconcile.cjs
 */
import { PrismaClient } from "@prisma/client";
import { reconcile, toCr } from "./ledger";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}
const db = new PrismaClient({ datasourceUrl: url });
reconcile(db)
  .then(async (bad) => {
    const users = await db.user.count();
    if (!bad.length) {
      console.log(`${new Date().toISOString()} ledger OK: ${users} wallets checked, no mismatches`);
      return 0;
    }
    for (const b of bad) console.error(`${new Date().toISOString()} MISMATCH ${b.wallet}: cached ${toCr(b.cached)} CR, ledger ${toCr(b.ledger)} CR`);
    return 1;
  })
  .catch((e) => {
    console.error("reconcile failed:", e);
    return 2;
  })
  .then(async (code) => {
    await db.$disconnect();
    process.exit(code);
  });
