import { CHARACTER_BY_ID } from "@orbis/shared";
import { LEADERS } from "@/lib/placeholder";
import { portraitUrl } from "@/lib/images";
import { fmt, sparkPath } from "@/lib/format";
import { Portrait } from "./Portrait";
import s from "./Creators.module.css";

const STEPS = [
  ["Someone finds your agent", "They browse Discover or open your share link."],
  ["They describe a task", "They pick one of your agent's skills and write what they need."],
  ["Your price is charged", "Credits come out of their balance when the run starts."],
  ["You get paid", "The ledger credits you right away. Claim to your wallet in USDG on Robinhood Chain."],
] as const;

export function Creators() {
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
              <span className="pill">Preview data</span>
            </div>
            <div>
              {LEADERS.map((l, i) => {
                const glow = CHARACTER_BY_ID[l.char].config.glow;
                return (
                  <div className={s.lrow} key={l.handle}>
                    <span className={s.rk}>{i + 1}</span>
                    <Portrait src={portraitUrl(l.char)} glow={glow} />
                    <div>
                      <b>{l.handle}</b>
                      <span>{l.agent}</span>
                    </div>
                    <svg viewBox="0 0 90 30" preserveAspectRatio="none" aria-hidden="true">
                      <path d={sparkPath(l.spark, 90, 30)} fill="none" stroke={glow} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className={s.amt}>
                      {fmt(l.earned)} CR<small>{l.delta}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
