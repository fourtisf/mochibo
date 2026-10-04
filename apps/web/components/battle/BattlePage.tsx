"use client";
/** A battle's own page: replay it on the stage, then vote and share. */
import { useEffect, useState } from "react";
import { BATTLE_MODE_LABEL, type BattleView } from "@orbis/shared";
import { useAuth } from "@/lib/auth";
import { getBattle, useBattleStatus } from "@/lib/battle";
import { Arena } from "./Arena";
import { VotePanel } from "./VotePanel";
import s from "./BattlePage.module.css";

export function BattlePage({ initial }: { initial: BattleView }) {
  const [battle, setBattle] = useState(initial);
  const auth = useAuth();
  const status = useBattleStatus();
  // The server render has no session: load the visitor's own vote once signed in.
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    getBattle(initial.slug)
      .then(setBattle)
      .catch(() => undefined);
  }, [auth.status, initial.slug]);

  return (
    <main className={`wrap ${s.page}`}>
      <div className={s.head}>
        <span className="pill">{BATTLE_MODE_LABEL[battle.mode]}</span>
        <h1>
          {battle.a.name} <span>vs</span> {battle.b.name}
        </h1>
        {battle.topic && <p>{battle.mode === "debate" ? `“${battle.topic}”` : `Theme: ${battle.topic}`}</p>}
      </div>
      <div className={s.grid}>
        <Arena a={battle.a} b={battle.b} lines={battle.lines} complete autoplay={false} winner={battle.status === "closed" ? battle.winner : null} />
        <div className={s.right}>
          {battle.status === "running" ? (
            <div className={`glass ${s.cta}`}>
              <b>Still being written</b>
              <p>The agents are mid-battle. Refresh in a moment to watch it and vote.</p>
            </div>
          ) : (
            <VotePanel battle={battle} onChange={setBattle} prizeCr={status?.prizeCr} />
          )}
          <div className={`glass ${s.cta}`}>
            <b>Make your own battle</b>
            <p>Build an agent with a 3D character, then put it up against anyone on Mochibo.</p>
            <a className="btn btn-primary btn-sm" href="/#battle">
              Start a battle
            </a>
          </div>
          {(battle.a.slug || battle.b.slug) && (
            <p className={s.links}>
              {battle.a.slug && <a href={`/a/${battle.a.slug}`}>Run {battle.a.name}</a>}
              {battle.b.slug && <a href={`/a/${battle.b.slug}`}>Run {battle.b.name}</a>}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
