import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { systemPrompt } from "./ai";
import { buildApp } from "./app";
import { loadEnv } from "./env";
import { reconcile } from "./ledger";
import { memoryStore } from "./store";

// These tests use a real PostgreSQL database (money logic lives in SQL transactions). Point
// TEST_DATABASE_URL at an empty database with the migrations applied, for example:
//   TEST_DATABASE_URL=postgresql://mochibo:devpass@127.0.0.1:5432/mochibo_test pnpm --filter @orbis/api test
// Every test starts from empty tables. Without the variable the suite is skipped.
const DB_URL = process.env.TEST_DATABASE_URL;
const db = DB_URL ? new PrismaClient({ datasourceUrl: DB_URL }) : (null as unknown as PrismaClient);
if (!DB_URL) console.warn("TEST_DATABASE_URL is not set: API tests are skipped.");
beforeEach(async () => {
  if (DB_URL) await db.$executeRawUnsafe('TRUNCATE "Rating", "LedgerEntry", "Run", "Claim", "Deposit", "Agent", "User" CASCADE');
});
afterAll(async () => {
  if (DB_URL) await db.$disconnect();
});

const ORIGIN = "https://mochibo.studio";
const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const AGENT = { name: "Juni", instructions: "SECRET-INSTRUCTIONS", tone: "Friendly", lang: "English", skills: ["writer", "summary"] };
const RUN = { source: "studio", agent: AGENT, skillId: "writer", task: "Write a hello post" };

/** A fake OpenRouter that streams the given pieces as SSE (with a keep-alive comment and usage). */
function fakeProvider(pieces: string[], opts: { status?: number; calls?: { body: string }[] } = {}): typeof fetch {
  return (async (_url: string, init: RequestInit) => {
    opts.calls?.push({ body: String(init.body) });
    if (opts.status) return new Response("nope", { status: opts.status });
    const lines = [": OPENROUTER PROCESSING", ...pieces.map((p) => `data: ${JSON.stringify({ model: "test/model", choices: [{ delta: { content: p } }] })}`)];
    lines.push(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 50, completion_tokens: 9 } })}`, "data: [DONE]");
    return new Response(lines.join("\n\n") + "\n\n", { headers: { "Content-Type": "text/event-stream" } });
  }) as unknown as typeof fetch;
}

function setup(over: Record<string, string> = {}, fetchImpl: typeof fetch = fakeProvider(["Hello ", "world"])) {
  const env = loadEnv({ APP_URL: ORIGIN, OPENROUTER_API_KEY: "k", AI_MODEL: "test/model", ...over } as NodeJS.ProcessEnv);
  const store = memoryStore();
  const app = buildApp({ env, store, db, fetchImpl, logger: false });
  return { app, store, env };
}

async function signIn(app: ReturnType<typeof setup>["app"], domain = "mochibo.studio") {
  const { nonce } = (await app.inject({ method: "GET", url: "/auth/nonce" })).json();
  const message = createSiweMessage({ address: account.address, chainId: 1, domain, nonce, uri: ORIGIN, version: "1" });
  const signature = await account.signMessage({ message });
  const res = await app.inject({ method: "POST", url: "/auth/verify", headers: { origin: ORIGIN }, payload: { message, signature } });
  const cookie = res.cookies.find((c) => c.name === "mochibo_session");
  return { res, cookie: cookie ? `${cookie.name}=${cookie.value}` : "", message, signature, rawCookie: cookie };
}

const events = (body: string) =>
  body
    .split("\n\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)));

let apps: { close(): Promise<unknown> }[] = [];
afterEach(async () => {
  await Promise.all(apps.map((a) => a.close()));
  apps = [];
});

describe.skipIf(!DB_URL)("auth", () => {
  it("signs in with SIWE and sets an httpOnly session cookie", async () => {
    const { app } = setup();
    apps.push(app);
    const { res, cookie, rawCookie } = await signIn(app);
    expect(res.statusCode).toBe(200);
    expect(res.json().address).toBe(account.address.toLowerCase());
    expect(rawCookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    const me = await app.inject({ method: "GET", url: "/me", headers: { cookie } });
    expect(me.json().address).toBe(account.address.toLowerCase());
  });

  it("rejects a reused nonce, another domain, a bad signature and a missing Origin", async () => {
    const { app } = setup();
    apps.push(app);
    const first = await signIn(app);
    const replay = await app.inject({ method: "POST", url: "/auth/verify", headers: { origin: ORIGIN }, payload: { message: first.message, signature: first.signature } });
    expect(replay.statusCode).toBe(401);

    expect((await signIn(app, "evil.example")).res.statusCode).toBe(401);

    const { nonce } = (await app.inject({ method: "GET", url: "/auth/nonce" })).json();
    const message = createSiweMessage({ address: account.address, chainId: 1, domain: "mochibo.studio", nonce, uri: ORIGIN, version: "1" });
    const other = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
    const bad = await app.inject({ method: "POST", url: "/auth/verify", headers: { origin: ORIGIN }, payload: { message, signature: await other.signMessage({ message }) } });
    expect(bad.statusCode).toBe(401);

    const noOrigin = await app.inject({ method: "POST", url: "/auth/verify", payload: { message, signature: "0x00" } });
    expect(noOrigin.statusCode).toBe(403);
  });

  it("accepts the www twin of the site for sign-in and writes", async () => {
    const { app } = setup();
    apps.push(app);
    const { nonce } = (await app.inject({ method: "GET", url: "/auth/nonce" })).json();
    const message = createSiweMessage({ address: account.address, chainId: 1, domain: "www.mochibo.studio", nonce, uri: "https://www.mochibo.studio", version: "1" });
    const res = await app.inject({ method: "POST", url: "/auth/verify", headers: { origin: "https://www.mochibo.studio" }, payload: { message, signature: await account.signMessage({ message }) } });
    expect(res.statusCode).toBe(200);
  });

  it("requires the configured chain id", async () => {
    const { app } = setup({ CHAIN_ID: "4663" });
    apps.push(app);
    expect((await signIn(app)).res.statusCode).toBe(401);
  });

  it("logs out", async () => {
    const { app } = setup();
    apps.push(app);
    const { cookie } = await signIn(app);
    await app.inject({ method: "POST", url: "/auth/logout", headers: { origin: ORIGIN, cookie } });
    expect((await app.inject({ method: "GET", url: "/me", headers: { cookie } })).json().address).toBeNull();
  });
});

describe.skipIf(!DB_URL)("runs", () => {
  it("needs a signed-in wallet", async () => {
    const { app } = setup();
    apps.push(app);
    const res = await app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN }, payload: RUN });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("sign_in");
  });

  it("streams the answer and keeps instructions in the system prompt", async () => {
    const calls: { body: string }[] = [];
    const { app } = setup({}, fakeProvider(["Hello ", "world"], { calls }));
    apps.push(app);
    const { cookie } = await signIn(app);
    const res = await app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: RUN });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(events(res.body)).toEqual([{ t: "start", cost: 5, balance: 95 }, { t: "delta", text: "Hello " }, { t: "delta", text: "world" }, { t: "done", balance: 95 }]);
    const sent = JSON.parse(calls[0].body);
    expect(sent.model).toBe("test/model");
    expect(sent.stream).toBe(true);
    expect(sent.messages[0]).toMatchObject({ role: "system" });
    expect(sent.messages[0].content).toContain("SECRET-INSTRUCTIONS");
    expect(sent.messages[1]).toEqual({ role: "user", content: "Write a hello post" });
    const status = await app.inject({ method: "GET", url: "/runs/status", headers: { cookie } });
    expect(status.json()).toMatchObject({ live: true, signedIn: true, usedToday: 1 });
  });

  it("rejects a skill that is not equipped and an empty task", async () => {
    const { app } = setup();
    apps.push(app);
    const { cookie } = await signIn(app);
    const a = await app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: { ...RUN, skillId: "code" } });
    expect(a.statusCode).toBe(400);
    const b = await app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: { ...RUN, task: "  " } });
    expect(b.statusCode).toBe(400);
  });

  it("enforces the daily limit per wallet", async () => {
    const { app } = setup({ RUNS_PER_WALLET_PER_DAY: "2" });
    apps.push(app);
    const { cookie } = await signIn(app);
    const go = () => app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: RUN });
    expect((await go()).statusCode).toBe(200);
    expect((await go()).statusCode).toBe(200);
    const third = await go();
    expect(third.statusCode).toBe(429);
    expect(third.json().error).toBe("daily_limit");
  });

  it("pauses when the total daily cap is reached", async () => {
    const { app } = setup({ RUNS_PER_DAY_TOTAL: "1" });
    apps.push(app);
    const { cookie } = await signIn(app);
    const go = () => app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: RUN });
    expect((await go()).statusCode).toBe(200);
    expect((await go()).json().error).toBe("paused");
  });

  it("gives the run back when the provider fails", async () => {
    const { app } = setup({}, fakeProvider([], { status: 500 }));
    apps.push(app);
    const { cookie } = await signIn(app);
    const res = await app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: RUN });
    expect(events(res.body)).toEqual([{ t: "start", cost: 5, balance: 95 }, { t: "error", balance: 100, message: expect.stringContaining("refunded") }]);
    const status = await app.inject({ method: "GET", url: "/runs/status", headers: { cookie } });
    expect(status.json().usedToday).toBe(0);
  });

  it("says live answers are off when no key or model is set", async () => {
    const { app } = setup({ OPENROUTER_API_KEY: "" });
    apps.push(app);
    const { cookie } = await signIn(app);
    const res = await app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: RUN });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("ai_offline");
  });
});

describe("systemPrompt", () => {
  it("follows the prototype shape and tells the research skill it cannot browse", () => {
    const p = systemPrompt({ ...AGENT, skills: ["research"] } as never, "research", false);
    expect(p).toContain("You are Juni, an AI agent.");
    expect(p).toContain("Tone: Friendly. Answer in English.");
    expect(p).toContain("cannot browse the web");
    expect(systemPrompt({ ...AGENT, skills: ["research"] } as never, "research", true)).not.toContain("cannot browse");
  });
});

describe.skipIf(!DB_URL)("credits", () => {
  const me = async (app: ReturnType<typeof setup>["app"], cookie: string) => (await app.inject({ method: "GET", url: "/me", headers: { cookie } })).json();

  it("grants the welcome credits once per wallet", async () => {
    const { app } = setup();
    apps.push(app);
    const { cookie } = await signIn(app);
    await signIn(app);
    expect((await me(app, cookie)).balance).toBe(100);
    const ledger = (await app.inject({ method: "GET", url: "/me/ledger", headers: { cookie } })).json().entries;
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "WELCOME", amount: 100, balanceAfter: 100 });
  });

  it("debits a studio run, records it and keeps the ledger reconciled", async () => {
    const { app } = setup();
    apps.push(app);
    const { cookie } = await signIn(app);
    await app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: RUN });
    expect((await me(app, cookie)).balance).toBe(95);
    const run = await db.run.findFirstOrThrow();
    expect(run).toMatchObject({ status: "DONE", source: "studio", cost: 500n, model: "test/model", tokensIn: 50, tokensOut: 9, task: null });
    const types = (await app.inject({ method: "GET", url: "/me/ledger", headers: { cookie } })).json().entries.map((e: { type: string }) => e.type);
    expect(types).toEqual(["RUN_DEBIT", "WELCOME"]);
    expect(await reconcile(db)).toEqual([]);
  });

  it("prices example agents on the server", async () => {
    const { app } = setup();
    apps.push(app);
    const { cookie } = await signIn(app);
    const go = (payload: object) => app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload });
    const ok = await go({ source: "example", exampleId: "m1", skillId: "research", task: "TSLA" });
    expect(events(ok.body)[0]).toEqual({ t: "start", cost: 15, balance: 85 });
    expect((await go({ source: "example", exampleId: "nope", skillId: "research", task: "x" })).statusCode).toBe(404);
    expect((await go({ source: "example", exampleId: "m1", skillId: "code", task: "x" })).statusCode).toBe(400);
  });

  it("refuses a run the balance cannot pay for, without using a daily run", async () => {
    const { app } = setup({ WELCOME_CREDITS: "3" });
    apps.push(app);
    const { cookie } = await signIn(app);
    const res = await app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: RUN });
    expect(res.statusCode).toBe(402);
    expect(res.json()).toMatchObject({ error: "no_credits", balance: 3 });
    expect((await app.inject({ method: "GET", url: "/runs/status", headers: { cookie } })).json().usedToday).toBe(0);
    expect(await db.run.count()).toBe(0);
  });

  it("refunds a failed run in full", async () => {
    const { app } = setup({}, fakeProvider([], { status: 502 }));
    apps.push(app);
    const { cookie } = await signIn(app);
    await app.inject({ method: "POST", url: "/runs", headers: { origin: ORIGIN, cookie }, payload: RUN });
    expect((await me(app, cookie)).balance).toBe(100);
    expect((await db.run.findFirstOrThrow()).status).toBe("REFUNDED");
    expect(await reconcile(db)).toEqual([]);
  });
});
