import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_NAME, CHARACTER_BY_ID } from "@orbis/shared";
import { EmbedView } from "@/components/EmbedView";

/**
 * Embed page: only the 3D stage (the prototype's ?view=embed mode). Framing is allowed on
 * /embed/* only (next.config.mjs). Phase 1 resolves the 12 base characters by id; phase 2
 * looks the slug up through the API (public fields only, never instructions).
 */
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = CHARACTER_BY_ID[params.slug];
  return { title: c ? `${c.name} on ${APP_NAME}` : APP_NAME, robots: { index: false } };
}

export default function EmbedPage({ params }: { params: { slug: string } }) {
  const c = CHARACTER_BY_ID[params.slug];
  if (!c) notFound();
  return <EmbedView name={c.name} role={c.role} config={c.config} />;
}
