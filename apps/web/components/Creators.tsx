"use client";
import { CHARACTER_BY_ID } from "@orbis/shared";
import { fmt, shortAddress } from "@/lib/format";
import { portraitUrl } from "@/lib/images";
import { useLeaderboard } from "@/lib/stats";
import { Portrait } from "./Portrait";
import s from "./Creators.module.css";

const STEPS = [
  ["Someone finds your agent", "They browse Discover or open your share link."],
  ["They describe a task", "They pick one of your agent's skills and write what they need."],
  ["Your price is charged", "Credits come out of their balance when the run starts."],
  ["You get paid", "The ledger credits you right away. Claim to your wallet in USDG on Robinhood Chain."],
] as const;

export function Creators() {
  const board = useLeaderboard();
  const creators = board?.creators ?? [];
  return (
    <section id="creators">
      <div className="wrap">
        <div className="head">
          <h2>Build once. Earn while you sleep.</h2>
          <p>Credits move from the person running a task to the creator in a single ledger entry. Failed runs are refunded automatically.</p>
        </div>
        <div className={s.split}>
          <div className={s.flow}>
            <h3>How a run pays out</h3>
            <ol>
              {STEPS.map(([t, d]) => (
                <li key={t}>
                  <div>
                    <b>{t}</b>
                    <p>{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className={s.board}>
            <div className={s.boardH}>
              <h3>Top creators this week</h3>
              <span className="pill">Last 7 days</span>
            </div>
            {creators.length > 0 ? (
              <div>
                {creators.map((c, i) => {
                  const base = c.topAgent && CHARACTER_BY_ID[c.topAgent.baseId] ? c.topAgent.baseId : "juni";
                  return (
                    <a className={s.lrow} key={c.wallet} href={c.topAgent ? `/a/${c.topAgent.slug}` : "#discover"}>
                      <span className={s.rk}>{i + 1}</span>
                      <Portrait src={c.topAgent?.thumbnailUrl || portraitUrl(base)} glow={CHARACTER_BY_ID[base].config.glow} />
                      <div>
                        <b>{shortAddress(c.wallet)}</b>
                        <span>{c.topAgent ? c.topAgent.name : "Creator"}</span>
                      </div>
                      <span>{fmt(c.runs)} runs</span>
                      <div className={s.amt}>
                        {fmt(c.earned)} CR<small>earned</small>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className={s.empty}>
              <img src="/brand/mochibo-wave.webp" alt="" width={220} height={220} loading="lazy" />
              <b>No creators ranked yet</b>
              <p>Publish an agent and earn from its runs to be the first on this week&apos;s board.</p>
              <a className="btn btn-glass btn-sm" href="#studio">
                Open the studio
              </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
