/* Server env, validated once at startup. Secrets live only here (never in NEXT_PUBLIC_* vars). */
import { ECONOMICS } from "@orbis/shared";
import { z } from "zod";

const bool = (def: boolean) =>
  z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => (v ? v === "true" : def));
const int = (def: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === "") return def;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a whole number" });
        return z.NEVER;
      }
      return n;
    });

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: int(4000),
  /** Public site URL. Its host is the SIWE domain and its origin is the only allowed Origin for writes. */
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Empty runs an in-memory store (development and tests only). */
  REDIS_URL: z.string().default(""),
  /** PostgreSQL for users and the credits ledger. */
  DATABASE_URL: z.string().default(""),
  /** One-time free credits for a new wallet. */
  WELCOME_CREDITS: int(ECONOMICS.previewStartCr),
  /** Price of a studio run of your own agent, in whole CR. */
  RUN_COST_CR: int(ECONOMICS.runCostCr),
  /** Chain id required in the SIWE message. Empty accepts any chain until Robinhood Chain values are confirmed. */
  CHAIN_ID: int(0),
  /** Optional RPC used to verify smart-contract wallet signatures (ERC-1271/6492). EOAs never need it. */
  RPC_URL: z.string().default(""),

  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  /** OpenRouter model id, for example "provider/model-name". Pick it at openrouter.ai/models. */
  AI_MODEL: z.string().default(""),
  AI_MAX_TOKENS: int(700),
  AI_TIMEOUT_MS: int(60000),
  /** Gives the Web research skill OpenRouter's web search (paid per request). */
  ENABLE_WEB_SEARCH: bool(false),

  RATE_LIMIT_RUNS_PER_MIN: int(6),
  /** Live runs one wallet can start per UTC day. */
  RUNS_PER_WALLET_PER_DAY: int(20),
  /** Live runs across all wallets per UTC day. When reached, runs pause until midnight UTC. */
  RUNS_PER_DAY_TOTAL: int(500),
  SESSION_DAYS: int(7),
});

export type Env = z.infer<typeof EnvSchema> & {
  appOrigin: string;
  /** The site's origins: APP_URL and its www twin (Nginx serves both). */
  appOrigins: string[];
  siweDomain: string;
  /** Hosts a SIWE message may name: APP_URL's host and its www twin. */
  siweDomains: string[];
  aiReady: boolean;
  secureCookies: boolean;
};

export function loadEnv(src: NodeJS.ProcessEnv = process.env): Env {
  const r = EnvSchema.safeParse(src);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid API environment:\n${lines}`);
  }
  const e = r.data;
  const url = new URL(e.APP_URL);
  const twin = url.hostname.startsWith("www.") ? url.host.slice(4) : `www.${url.host}`;
  const isIp = /^[\d.]+$/.test(url.hostname) || url.hostname === "localhost";
  const hosts = isIp ? [url.host] : [url.host, twin];
  return {
    ...e,
    appOrigin: url.origin,
    appOrigins: hosts.map((h) => `${url.protocol}//${h}`),
    siweDomain: url.host,
    siweDomains: hosts,
    aiReady: Boolean(e.OPENROUTER_API_KEY && e.AI_MODEL),
    secureCookies: url.protocol === "https:",
  };
}
