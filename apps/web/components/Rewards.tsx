"use client";
import { TIERS, TOKEN_SYMBOL, formatBps } from "@orbis/shared";
import s from "./Rewards.module.css";

/**
 * Holder tiers lower the creator fee. Holder rewards (CLAUDE.md 5.9) are not promised here:
 * they ship only after the owner confirms the asset, the rate and the legal setup.
 */
export function Rewards() {
  const best = TIERS[TIERS.length - 1];

  return (
    <section id="rewards">
      <div className={`wrap ${s.rw}`}>
        <div className={s.card}>
          <h3>Hold {TOKEN_SYMBOL}. Keep more of what you earn.</h3>
          <p>
            Holders pay a lower creator fee on every run of their agents, down to {formatBps(best.feeBps)} for {best.name} holders. Your tier is read from the
            wallet you connect. No staking and no lock-up.
          </p>
          <div className={s.out4}>
            {TIERS.map((t) => (
              <div key={t.id}>
                <small>{t.name}</small>
                <b>{formatBps(t.feeBps)} fee</b>
              </div>
            ))}
          </div>
          <p className={`note ${s.fineNote}`}>
            Holder rewards are planned for later. They will only launch once the details and the legal setup are confirmed, and we will announce them on X first.
            Nothing here is financial advice.
          </p>
        </div>
        <div className={s.tiers}>
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Hold</th>
                <th>Creator fee</th>
                <th>Rewards</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t) => (
                <tr key={t.id} className={t.id === "BUILDER" ? s.hl : undefined}>
                  <td>{t.name}</td>
                  <td>{t.holdLabel}</td>
                  <td>{formatBps(t.feeBps)}</td>
                  <td>{t.minHold > 0 ? "Planned" : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.fine}>Fee discounts apply to what you earn as a creator. Tiers turn on when the token is live.</div>
        </div>
      </div>
    </section>
  );
}
