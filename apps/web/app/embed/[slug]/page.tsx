import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_NAME, CHARACTER_BY_ID, normalizeCharacter } from "@orbis/shared";
import { EmbedView } from "@/components/EmbedView";
import { getPublicAgent } from "@/lib/server-api";

/**
 * Embed page: only the 3D stage (the prototype's ?view=embed mode). Framing is allowed on
 * /embed/* only (next.config.mjs). Resolves a published agent's slug through the API (public fields
 * only, never instructions), or one of the 12 base characters by id.
 */
async function resolve(slug: string) {
  const c = CHARACTER_BY_ID[slug];
  if (c) return { name: c.name, role: c.role, config: c.config };
  const a = await getPublicAgent(slug);
  if (!a) return null;
  return { name: a.name, role: CHARACTER_BY_ID[a.baseId]?.role ?? "Agent", config: normalizeCharacter(a.character) };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await resolve(params.slug);
  return { title: r ? `${r.name} on ${APP_NAME}` : APP_NAME, robots: { index: false } };
}

export default async function EmbedPage({ params }: { params: { slug: string } }) {
  const r = await resolve(params.slug);
  if (!r) notFound();
  return <EmbedView name={r.name} role={r.role} config={r.config} />;
}
