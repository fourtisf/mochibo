import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app";
import { loadEnv } from "./env";
import { memoryStore, redisStore } from "./store";

const env = loadEnv();
if (env.NODE_ENV === "production" && !env.REDIS_URL) throw new Error("REDIS_URL is required in production.");
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required (PostgreSQL for users and credits).");
const store = env.REDIS_URL ? redisStore(env.REDIS_URL) : memoryStore();
const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
const app = buildApp({ env, store, db });

if (!env.aiReady) app.log.warn("OPENROUTER_API_KEY or AI_MODEL is empty: runs return ai_offline until both are set.");

const close = async () => {
  await app.close();
  await store.close();
  await db.$disconnect();
  process.exit(0);
};
process.on("SIGINT", close);
process.on("SIGTERM", close);

app.listen({ host: env.HOST, port: env.PORT }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
