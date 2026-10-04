/* Sign-In with Ethereum (EIP-4361) and cookie sessions stored in Redis. */
import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createPublicClient, http, isAddress, verifyMessage, type Hex } from "viem";
import { generateSiweNonce, parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { z } from "zod";
import type { Env } from "./env";
import type { Store } from "./store";

export const SESSION_COOKIE = "mochibo_session";
const NONCE_TTL = 5 * 60;

const VerifyBody = z
  .object({
    message: z.string().min(1).max(2000),
    signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(20000),
  })
  .strict();

/** Fixed-window limit per key. Returns false when the caller is over the limit. */
export async function allow(store: Store, key: string, limit: number, windowSec: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  return (await store.incr(`rl:${key}:${bucket}`, windowSec + 5)) <= limit;
}

export async function sessionAddress(store: Store, req: FastifyRequest): Promise<string | null> {
  const sid = req.cookies[SESSION_COOKIE];
  if (!sid || sid.length > 100) return null;
  return store.get(`sess:${sid}`);
}

export function authRoutes(app: FastifyInstance, env: Env, store: Store): void {
  // Smart-contract wallets (for example Coinbase Smart Wallet) need an RPC to verify; plain wallets do not.
  const client = env.RPC_URL ? createPublicClient({ transport: http(env.RPC_URL) }) : null;
  const cookieOpts = { path: "/", httpOnly: true, secure: env.secureCookies, sameSite: "lax" as const };

  const tooMany = (reply: FastifyReply) => reply.code(429).send({ error: "too_many_requests", message: "Too many attempts. Wait a minute and try again." });

  app.get("/auth/nonce", async (req, reply) => {
    if (!(await allow(store, `nonce:${req.ip}`, 30, 60))) return tooMany(reply);
    const nonce = generateSiweNonce();
    await store.set(`nonce:${nonce}`, "1", NONCE_TTL);
    reply.header("Cache-Control", "no-store");
    return { nonce };
  });

  app.post("/auth/verify", async (req, reply) => {
    if (!(await allow(store, `verify:${req.ip}`, 20, 60))) return tooMany(reply);
    const body = VerifyBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid", message: "Invalid sign-in request." });
    const fail = (message: string) => reply.code(401).send({ error: "sign_in_failed", message });

    const msg = parseSiweMessage(body.data.message);
    if (!msg.address || !isAddress(msg.address) || !msg.nonce) return fail("The sign-in message is not valid.");
    if (env.CHAIN_ID && msg.chainId !== env.CHAIN_ID) return fail("Switch to the supported network, then sign in again.");
    if (!validateSiweMessage({ message: msg, domain: env.siweDomain, nonce: msg.nonce })) return fail("The sign-in message is for another site or has expired.");
    // One use per nonce, and only nonces this server issued in the last 5 minutes.
    if (!(await store.take(`nonce:${msg.nonce}`))) return fail("The sign-in request expired. Try again.");

    const signature = body.data.signature as Hex;
    let ok = await verifyMessage({ address: msg.address, message: body.data.message, signature }).catch(() => false);
    if (!ok && client) ok = await client.verifyMessage({ address: msg.address, message: body.data.message, signature }).catch(() => false);
    if (!ok) return fail("The signature does not match the wallet.");

    const address = msg.address.toLowerCase();
    const sid = randomBytes(32).toString("base64url");
    const ttl = env.SESSION_DAYS * 86400;
    await store.set(`sess:${sid}`, address, ttl);
    reply.setCookie(SESSION_COOKIE, sid, { ...cookieOpts, maxAge: ttl });
    return { address };
  });

  app.post("/auth/logout", async (req, reply) => {
    const sid = req.cookies[SESSION_COOKIE];
    if (sid) await store.del(`sess:${sid}`);
    reply.clearCookie(SESSION_COOKIE, cookieOpts);
    return { ok: true };
  });
}
