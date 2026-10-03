"use client";
import { useState } from "react";
import { REWARDS, TIERS, formatBps } from "@orbis/shared";
import { PUBLIC_ENV } from "@/lib/env";
import { shortAddress } from "@/lib/format";
import { copyText } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import s from "./Rewards.module.css";

const money = (v: number) => "$" + (v < 1 ? v.toFixed(3) : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/**
 * Holder rewards are behind REWARDS_ENABLED and come last (CLAUDE.md 5.9). This section only
 * shows the sample-rate calculator from the prototype.
 */
export function Rewards() {
  const toast = useToast();
  const [hold, setHold] = useState("5,000,000");
  const [asset, setAsset] = useState<string>(REWARDS.sampleAssets[0]);
  const amt = +hold.replace(/[^\d.]/g, "") || 0;
  const h = (amt / 1e6) * REWARDS.samplePerMillionPerHour;
  const ca = PUBLIC_ENV.tokenAddress;

  return (
    <section id="rewards">
      <div className={`wrap ${s.rw}`}>
        <div className={s.card}>
          <h3>Hold ORBIS. Earn tokenized stocks every hour.</h3>
          <p>Holders pay lower fees and get an hourly reward in tokenized stock on Robinhood Chain. No staking and no lock-up.</p>
          <div className={s.calc}>
            <input
              className="input"
              inputMode="numeric"
              aria-label="ORBIS held"
              value={hold}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                setHold(raw ? (+raw).toLocaleString("en-US") : "");
              }}
            />
            <select className="input" aria-label="Reward asset" value={asset} onChange={(e) => setAsset(e.target.value)}>
              {REWARDS.sampleAssets.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className={s.out4}>
            <div>
              <small>Per hour</small>
              <b>{money(h)}</b>
            </div>
            <div>
              <small>Per day</small>
              <b>{money(h * 24)}</b>
            </div>
            <div>
              <small>Per month</small>
              <b>{money(h * 24 * 30)}</b>
            </div>
            <div>
              <small>Per year</small>
              <b>{money(h * 24 * 365)}</b>
            </div>
          </div>
          <div className={s.ca}>
            Token address <code>{ca ? shortAddress(ca) : "Coming soon"}</code>
            <button
              className="btn btn-glass btn-xs"
              onClick={async () => {
                if (!ca) return toast("Token address is not set yet");
                await copyText(ca);
                toast("Copied");
              }}
            >
              Copy
            </button>
          </div>
          <p className={`note ${s.fineNote}`}>
            Sample rate of ${REWARDS.samplePerMillionPerHour} per hour for every 1,000,000 ORBIS. Stock tokens are not shares and are not available to US persons. Not
            financial advice.
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
                  <td>{t.rewards}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.fine}>Your tier is read from the wallet you connect. Fee discounts apply to what you earn as a creator.</div>
        </div>
      </div>
    </section>
  );
}
