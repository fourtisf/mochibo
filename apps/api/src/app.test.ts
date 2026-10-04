import { afterEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { systemPrompt } from "./ai";
import { buildApp } from "./app";
import { loadEnv } from "./env";
import { memoryStore } from "./store";

const ORIGIN = "https://mochibo.studio";
const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const AGENT = { name: "Juni", instructions: "SECRET-INSTRUCTIONS", tone: "Friendly", lang: "English", skills: ["writer", "summary"] };
const RUN = { agent: AGENT, skillId: "writer", task: "Write a hello post" };

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
  const app = buildApp({ env, store, fetchImpl, logger: false });
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

describe("auth", () => {
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

describe("runs", () => {
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
    expect(events(res.body)).toEqual([{ t: "delta", text: "Hello " }, { t: "delta", text: "world" }, { t: "done" }]);
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
    expect(events(res.body)).toEqual([{ t: "error", message: expect.stringContaining("not counted") }]);
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
