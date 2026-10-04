import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_NAME, SKILL_BY_ID } from "@orbis/shared";
import { AgentPage } from "@/components/AgentPage";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import heroStyles from "@/components/Hero.module.css";
import { getPublicAgent } from "@/lib/server-api";

/** Share page of a published agent (CLAUDE.md 5.7). Server-rendered; never shows the instructions. */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const agent = await getPublicAgent(params.slug);
  if (!agent) return { title: `Agent not found – ${APP_NAME}`, robots: { index: false } };
  const title = `${agent.name} – an AI agent on ${APP_NAME}`;
  const description = `${agent.skills.map((id) => SKILL_BY_ID[id].name).join(", ")}. ${agent.price} CR per run. Run it in your browser.`;
  const images = agent.thumbnailUrl ? [{ url: agent.thumbnailUrl, width: 320, height: 360, alt: agent.name }] : undefined;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", url: `/a/${agent.slug}`, ...(images ? { images } : {}) },
    twitter: { card: images ? "summary" : "summary_large_image", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}

export default async function AgentSharePage({ params }: { params: { slug: string } }) {
  const agent = await getPublicAgent(params.slug);
  if (!agent) notFound();
  return (
    <Providers>
      <div className={heroStyles.aurora} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <Nav />
      <AgentPage agent={agent} />
      <Footer />
    </Providers>
  );
}
