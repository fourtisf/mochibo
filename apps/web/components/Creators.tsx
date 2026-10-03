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
              <span className="pill">Opens with publishing</span>
            </div>
            <div className={s.empty}>
              <img src="/brand/mochibo-wave.webp" alt="" width={220} height={220} loading="lazy" />
              <b>No creators ranked yet</b>
              <p>The weekly leaderboard starts when publishing goes live. Build your agent now and be one of the first on it.</p>
              <a className="btn btn-glass btn-sm" href="#studio">
                Open the studio
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
