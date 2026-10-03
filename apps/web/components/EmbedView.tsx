"use client";
import dynamic from "next/dynamic";
import type { CharacterConfig } from "@orbis/shared";
import { StageRegistryProvider } from "@/lib/stages";
import { PowerDock } from "./PowerDock";
import s from "./Hero.module.css";

const HeroStage = dynamic(() => import("./HeroStage"), { ssr: false });

export function EmbedView({ name, role, config }: { name: string; role: string; config: CharacterConfig }) {
  return (
    <StageRegistryProvider>
      <main className={`${s.hero} ${s.embed}`}>
        <div className={`win ${s.win}`}>
          <div className="win-bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span className="bar-right">
              <span className={s.live}>
                <i />
                Live 3D in your browser
              </span>
            </span>
          </div>
          <div className={s.body}>
            <HeroStage mode={{ kind: "single", config }} label={`${name} in 3D. Drag to turn it, tap to say hi.`} />
            <div className={s.hint}>Drag to turn. Tap a character to say hi.</div>
            <div className={s.cap}>
              <b>{name}</b>
              <span>{role}</span>
            </div>
            <PowerDock slot="hero" className={s.dock} />
          </div>
        </div>
      </main>
    </StageRegistryProvider>
  );
}
