import type { Metadata } from "next";
import { APP_NAME, TOKEN_SYMBOL } from "@orbis/shared";
import { DocPage } from "@/components/DocPage";
import s from "./Roadmap.module.css";

export const metadata: Metadata = { title: `Roadmap – ${APP_NAME}` };

const STEPS = [
  {
    state: "Live",
    title: "Build, run and publish",
    items: [
      "The 3D studio with 12 characters, full styling, gear, a floating buddy and talking characters",
      "Sign in with your wallet, free welcome credits and a credits ledger",
      "Live AI answers with follow-up chat, link reading and up to 4 of 8 skills",
      "Agents saved to your account, published to Discover, shared with a link or embedded on any site",
      "Creators earn from every run, failed runs are refunded, ratings and a weekly leaderboard",
    ],
  },
  {
    state: "Next",
    title: "USDG on Robinhood Chain",
    items: ["Top up credits with USDG and claim earnings back to your wallet", "Testnet first, mainnet only after an external audit"],
  },
  {
    state: "Later",
    title: `${TOKEN_SYMBOL} holder tiers`,
    items: ["Lower creator fees for holders, read from your wallet", "Holder rewards only after the details and the legal setup are confirmed"],
  },
];

export default function Roadmap() {
  return (
    <DocPage title="Roadmap" lede="Where Mochibo is today and what comes next. We share dates on X when each step is ready, not before.">
      <ol className={s.list}>
        {STEPS.map((st) => (
          <li key={st.title} className={st.state === "Live" ? s.live : undefined}>
            <span className={s.state}>{st.state}</span>
            <h2>{st.title}</h2>
            <ul>
              {st.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </DocPage>
  );
}
