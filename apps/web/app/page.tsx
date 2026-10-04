import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Bento } from "@/components/Bento";
import { Studio } from "@/components/studio/Studio";
import { Discover } from "@/components/Discover";
import { Creators } from "@/components/Creators";
import { BattleSection } from "@/components/battle/BattleSection";
import { Rewards } from "@/components/Rewards";
import { Faq } from "@/components/Faq";
import { Final } from "@/components/Final";
import { Footer } from "@/components/Footer";
import { Providers } from "@/components/Providers";
import heroStyles from "@/components/Hero.module.css";

export default function Home() {
  return (
    <Providers>
      <div className={heroStyles.aurora} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <Nav />
      <main>
        <Hero />
        <Bento />
        <Studio />
        <Discover />
        <BattleSection />
        <Creators />
        <Rewards />
        <Faq />
        <Final />
      </main>
      <Footer />
    </Providers>
  );
}
