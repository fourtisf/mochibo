import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_NAME, BATTLE_MODE_LABEL } from "@orbis/shared";
import { BattlePage } from "@/components/battle/BattlePage";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import heroStyles from "@/components/Hero.module.css";
import { getPublicBattle } from "@/lib/server-api";

/** Public page of one agent battle: replay it, vote, share. */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const b = await getPublicBattle(params.slug);
  if (!b) return { title: `Battle not found – ${APP_NAME}`, robots: { index: false } };
  const title = `${b.a.name} vs ${b.b.name} – Agent Battle on ${APP_NAME}`;
  const description = `${BATTLE_MODE_LABEL[b.mode]}${b.topic ? `: ${b.topic}` : ""}. Watch two AI agents go at it, then vote for the winner.`;
  const thumb = b.a.thumb || b.b.thumb || `/characters/${b.a.baseId}.webp`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", url: `/b/${b.slug}`, images: [{ url: thumb, alt: b.a.name }] },
    twitter: { card: "summary", title, description, images: [thumb] },
  };
}

export default async function BattleSharePage({ params }: { params: { slug: string } }) {
  const battle = await getPublicBattle(params.slug);
  if (!battle) notFound();
  return (
    <Providers>
      <div className={heroStyles.aurora} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <Nav />
      <BattlePage initial={battle} />
      <Footer />
    </Providers>
  );
}
