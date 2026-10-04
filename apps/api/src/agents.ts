/*
 * Saved agents (CLAUDE.md 5.2 and 5.7): owner CRUD with autosave, publish with a price, the portrait
 * upload, Discover, the public agent page data, ratings, landing stats and the weekly leaderboard.
 * Instructions never leave this server except to their owner (GET /agents/mine) and the AI provider.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Agent, Prisma, PrismaClient, Tone as DbTone } from "@prisma/client";
import {
  AgentCreateSchema,
  AgentPatchSchema,
  PublishSchema,
  RatingSchema,
  SKILLS,
  normalizeCharacter,
  type CharacterConfig,
  type OwnAgent,
  type PublicAgent,
  type SkillId,
  type Tone,
} from "@orbis/shared";
import { allow, sessionAddress } from "./auth";
import type { Env } from "./env";
import { ensureUser, toCr } from "./ledger";
import type { Store } from "./store";

const TONE_TO_DB: Record<Tone, DbTone> = { Friendly: "FRIENDLY", Professional: "PROFESSIONAL", Concise: "CONCISE" };
const TONE_FROM_DB: Record<DbTone, Tone> = { FRIENDLY: "Friendly", PROFESSIONAL: "Professional", CONCISE: "Concise" };
export const toneFromDb = (t: DbTone): Tone => TONE_FROM_DB[t];
const MAX_AGENTS = 20;

export function slugify(s: string): string {
  const base =
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28) || "agent";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

const rating = (a: Agent) => (a.ratingCount ? Math.round((a.ratingSum / a.ratingCount) * 10) / 10 : null);

export function ownView(a: Agent): OwnAgent {
  return {
    id: a.id,
    slug: a.slug,
    baseId: a.baseId,
    name: a.name,
    instructions: a.instructions,
    tone: TONE_FROM_DB[a.tone],
    lang: "English",
    skills: a.skills as SkillId[],
    price: a.price,
    character: normalizeCharacter(a.character as Partial<CharacterConfig>),
    published: a.published,
    thumbnailUrl: a.thumbnailUrl,
    runsCount: a.runsCount,
    earned: toCr(a.earnedTotal),
    rating: rating(a),
    ratingCount: a.ratingCount,
  };
}

export function publicView(a: Agent & { owner: { wallet: string } }): PublicAgent {
  const { instructions: _i, earned: _e, ...rest } = ownView(a);
  return { ...rest, creator: a.owner.wallet };
}

const IMAGE_TYPES: [string, (b: Buffer) => boolean][] = [
  ["png", (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["webp", (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP"],
];

export function agentRoutes(app: FastifyInstance, env: Env, store: Store, db: PrismaClient): void {
  /** The signed-in user, or a 401 reply. */
  async function owner(req: FastifyRequest, reply: FastifyReply) {
    const wallet = await sessionAddress(store, req);
    if (!wallet) {
      reply.code(401).send({ error: "sign_in", message: "Connect your wallet and sign in first." });
      return null;
    }
    return ensureUser(db, wallet, env.WELCOME_CREDITS);
  }
  async function ownAgent(req: FastifyRequest, reply: FastifyReply) {
    const user = await owner(req, reply);
    if (!user) return null;
    const { id } = req.params as { id: string };
    const agent = await db.agent.findFirst({ where: { id: String(id).slice(0, 40), ownerId: user.id, deletedAt: null } });
    if (!agent) {
      reply.code(404).send({ error: "not_found", message: "Agent not found." });
      return null;
    }
    return { user, agent };
  }
  const bad = (reply: FastifyReply, message: string) => reply.code(400).send({ error: "invalid", message });
  const noStore = (reply: FastifyReply) => reply.header("Cache-Control", "no-store");

  app.get("/agents/mine", async (req, reply) => {
    noStore(reply);
    const user = await owner(req, reply);
    if (!user) return;
    const agents = await db.agent.findMany({ where: { ownerId: user.id, deletedAt: null }, orderBy: { updatedAt: "desc" } });
    return { agents: agents.map(ownView) };
  });

  app.post("/agents", async (req, reply) => {
    const user = await owner(req, reply);
    if (!user) return;
    if (!(await allow(store, `agents:create:${user.id}`, 20, 3600))) return reply.code(429).send({ error: "too_fast", message: "Too many new agents. Try again later." });
    const body = AgentCreateSchema.safeParse(req.body);
    if (!body.success) return bad(reply, body.error.issues[0]?.message ?? "Invalid agent.");
    if ((await db.agent.count({ where: { ownerId: user.id, deletedAt: null } })) >= MAX_AGENTS) {
      return bad(reply, `You can keep up to ${MAX_AGENTS} agents. Delete one to make room.`);
    }
    const d = body.data;
    const agent = await db.agent.create({
      data: {
        slug: slugify(d.name),
        ownerId: user.id,
        baseId: d.baseId,
        name: d.name,
        instructions: d.instructions,
        tone: TONE_TO_DB[d.tone],
        lang: "EN",
        skills: d.skills,
        price: d.price,
        character: d.character,
      },
    });
    return reply.code(201).send({ agent: ownView(agent) });
  });

  app.patch("/agents/:id", async (req, reply) => {
    const found = await ownAgent(req, reply);
    if (!found) return;
    if (!(await allow(store, `agents:save:${found.user.id}`, 240, 60))) return reply.code(429).send({ error: "too_fast", message: "Saving too often. Wait a moment." });
    const body = AgentPatchSchema.safeParse(req.body);
    if (!body.success) return bad(reply, body.error.issues[0]?.message ?? "Invalid change.");
    const d = body.data;
    const data: Prisma.AgentUpdateInput = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.instructions !== undefined) data.instructions = d.instructions;
    if (d.tone !== undefined) data.tone = TONE_TO_DB[d.tone];
    if (d.skills !== undefined) data.skills = d.skills;
    if (d.character !== undefined) data.character = d.character;
    if (d.baseId !== undefined) data.baseId = d.baseId;
    // A published agent needs at least one skill to stay runnable.
    if (found.agent.published && d.skills && d.skills.length === 0) return bad(reply, "A published agent needs at least one skill.");
    const agent = await db.agent.update({ where: { id: found.agent.id }, data });
    return { agent: ownView(agent) };
  });

  app.delete("/agents/:id", async (req, reply) => {
    const found = await ownAgent(req, reply);
    if (!found) return;
    await db.agent.update({ where: { id: found.agent.id }, data: { deletedAt: new Date(), published: false } });
    return { ok: true };
  });

  app.post("/agents/:id/publish", async (req, reply) => {
    const found = await ownAgent(req, reply);
    if (!found) return;
    const body = PublishSchema.safeParse(req.body);
    if (!body.success) return bad(reply, body.error.issues[0]?.message ?? "Invalid request.");
    const { published, price } = body.data;
    if (published && found.agent.skills.length === 0) return bad(reply, "Equip at least one skill before publishing.");
    const agent = await db.agent.update({
      where: { id: found.agent.id },
      data: { published, ...(price !== undefined ? { price } : {}), ...(published && !found.agent.publishedAt ? { publishedAt: new Date() } : {}) },
    });
    return { agent: ownView(agent) };
  });

  app.post("/agents/:id/thumbnail", { bodyLimit: 1_600_000 }, async (req, reply) => {
    const found = await ownAgent(req, reply);
    if (!found) return;
    if (!(await allow(store, `agents:thumb:${found.user.id}`, 30, 3600))) return reply.code(429).send({ error: "too_fast", message: "Too many uploads. Try again later." });
    const image = (req.body as { image?: unknown })?.image;
    const m = typeof image === "string" ? /^data:image\/(png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image) : null;
    if (!m) return bad(reply, "Send a PNG or WebP image.");
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 1_000_000) return bad(reply, "The image must be 1 MB or smaller.");
    const kind = IMAGE_TYPES.find(([, test]) => test(buf))?.[0];
    if (!kind) return bad(reply, "Send a PNG or WebP image.");
    // Random file name; the portrait comes from our own canvas renderer, which writes no metadata.
    const name = `${randomBytes(16).toString("hex")}.${kind}`;
    await mkdir(env.UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(env.UPLOAD_DIR, name), buf, { mode: 0o644 });
    const old = found.agent.thumbnailUrl;
    const agent = await db.agent.update({ where: { id: found.agent.id }, data: { thumbnailUrl: `/uploads/${name}` } });
    if (old?.startsWith("/uploads/")) await unlink(path.join(env.UPLOAD_DIR, path.basename(old))).catch(() => undefined);
    return { agent: ownView(agent) };
  });

  // Portraits. In production Nginx serves /uploads straight from disk; this is the fallback for development.
  app.get("/uploads/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    if (!/^[0-9a-f]{32}\.(png|webp)$/.test(name)) return reply.code(404).send();
    const buf = await readFile(path.join(env.UPLOAD_DIR, name)).catch(() => null);
    if (!buf) return reply.code(404).send();
    return reply
      .header("Content-Type", name.endsWith(".png") ? "image/png" : "image/webp")
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(buf);
  });

  app.get("/discover", async (req) => {
    const q = req.query as { cat?: string; sort?: string; cursor?: string };
    const skillsInCat = SKILLS.filter((s) => s.cat === q.cat).map((s) => s.id);
    const where: Prisma.AgentWhereInput = { published: true, deletedAt: null, ...(skillsInCat.length ? { skills: { hasSome: skillsInCat } } : {}) };
    const offset = Math.max(0, Math.min(1000, Number(q.cursor) || 0));
    const agents = await db.agent.findMany({
      where,
      include: { owner: { select: { wallet: true } } },
      orderBy: q.sort === "new" ? { publishedAt: "desc" } : [{ runsCount: "desc" }, { publishedAt: "desc" }],
      skip: offset,
      take: 24,
    });
    let list = agents.map(publicView);
    if (q.sort === "rating") list = list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.ratingCount - a.ratingCount);
    return { agents: list, next: agents.length === 24 ? String(offset + 24) : null };
  });

  app.get("/a/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const agent = await db.agent.findFirst({ where: { slug: String(slug).slice(0, 60), published: true, deletedAt: null }, include: { owner: { select: { wallet: true } } } });
    if (!agent) return reply.code(404).send({ error: "not_found", message: "This agent is not published." });
    return { agent: publicView(agent) };
  });

  app.post("/runs/:id/rating", async (req, reply) => {
    const user = await owner(req, reply);
    if (!user) return;
    const body = RatingSchema.safeParse(req.body);
    if (!body.success) return bad(reply, "Rate from 1 to 5 stars.");
    const { id } = req.params as { id: string };
    const run = await db.run.findFirst({ where: { id: String(id).slice(0, 40), runnerId: user.id }, include: { rating: true } });
    if (!run || !run.agentId) return reply.code(404).send({ error: "not_found", message: "Run not found." });
    if (run.status !== "DONE") return bad(reply, "Only finished runs can be rated.");
    if (run.rating) return reply.code(409).send({ error: "already_rated", message: "You already rated this run." });
    const stars = body.data.stars;
    await db.$transaction([
      db.rating.create({ data: { runId: run.id, agentId: run.agentId, userId: user.id, stars } }),
      db.agent.update({ where: { id: run.agentId }, data: { ratingSum: { increment: stars }, ratingCount: { increment: 1 } } }),
    ]);
    return { ok: true };
  });

  /** Small JSON cache in Redis for the public, read-heavy endpoints. */
  async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const hit = await store.get(key);
    if (hit) return JSON.parse(hit) as T;
    const value = await load();
    await store.set(key, JSON.stringify(value), ttl);
    return value;
  }

  app.get("/stats", async () =>
    cached("cache:stats", 60, async () => {
      const [agents, runs, paid, recent] = await Promise.all([
        db.agent.count({ where: { published: true, deletedAt: null } }),
        db.run.count({ where: { status: "DONE" } }),
        db.ledgerEntry.aggregate({ where: { type: "RUN_CREDIT" }, _sum: { amount: true } }),
        db.run.findMany({
          where: { status: "DONE", creatorNet: { gt: 0 }, agent: { published: true, deletedAt: null } },
          orderBy: { finishedAt: "desc" },
          take: 6,
          select: { skillId: true, creatorNet: true, finishedAt: true, agent: { select: { name: true, slug: true, baseId: true, thumbnailUrl: true } } },
        }),
      ]);
      return {
        agents,
        runs,
        paidToCreators: toCr(paid._sum.amount ?? 0n),
        recent: recent.map((r) => ({ agent: r.agent, skillId: r.skillId, earned: toCr(r.creatorNet), at: r.finishedAt })),
      };
    }),
  );

  app.get("/leaderboard", async () =>
    cached("cache:leaderboard", 300, async () => {
      const since = new Date(Date.now() - 7 * 86400_000);
      const rows = await db.$queryRaw<{ wallet: string; earned: bigint; runs: bigint }[]>`
        SELECT u.wallet, SUM(l.amount)::bigint AS earned, COUNT(*)::bigint AS runs
        FROM "LedgerEntry" l JOIN "User" u ON u.id = l."userId"
        WHERE l.type = 'RUN_CREDIT' AND l."createdAt" >= ${since}
        GROUP BY u.wallet ORDER BY earned DESC LIMIT 10`;
      const creators = await Promise.all(
        rows.map(async (r) => {
          const top = await db.agent.findFirst({
            where: { owner: { wallet: r.wallet }, published: true, deletedAt: null },
            orderBy: { runsCount: "desc" },
            select: { name: true, slug: true, baseId: true, thumbnailUrl: true },
          });
          return { wallet: r.wallet, earned: toCr(r.earned), runs: Number(r.runs), topAgent: top };
        }),
      );
      return { since, creators };
    }),
  );
}
