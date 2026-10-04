import type { Metadata } from "next";
import { APP_NAME, TOKEN_SYMBOL } from "@orbis/shared";
import { DocPage } from "@/components/DocPage";
import s from "./Roadmap.module.css";

export const metadata: Metadata = { title: `Roadmap – ${APP_NAME}` };

const STEPS = [
  {
    state: "Live",
    title: "Preview",
    items: ["The 3D studio with 12 characters, full styling, gear and a floating buddy", "Instructions, tone, language and up to 4 of 8 skills", "Powers, motions and the run flow", "Sign in with your wallet and get live AI answers, with a daily run limit"],
  },
  {
    state: "Next",
    title: "Accounts and agents",
    items: ["Agents saved to your account with autosave", "Publish to Discover, share links and website embeds"],
  },
  {
    state: "Then",
    title: "Real runs and credits",
    items: ["A credits ledger: runners pay, creators earn, failed runs are refunded", "Ratings, the weekly creator leaderboard and real stats on the home page"],
  },
  {
    state: "Then",
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
