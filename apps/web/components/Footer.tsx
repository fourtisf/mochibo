import { APP_NAME, SOCIAL } from "@orbis/shared";
import s from "./Footer.module.css";

const COLS = [
  ["Product", [["#studio", "Studio"], ["#discover", "Discover"], ["#features", "Skills"], ["#rewards", "Rewards"]]],
  ["Learn", [["#faq", "FAQ"], ["#creators", "For creators"], ["#top", "Whitepaper"], ["#top", "Roadmap"]]],
  ["Community", [[SOCIAL.x, "X"], [SOCIAL.telegram || "#top", "Telegram"], ["#top", "GitHub"]]],
] as const;

export function Footer() {
  return (
    <footer className={s.footer}>
      <div className="wrap">
        <div className={s.foot}>
          <div>
            <a className={`logo ${s.logoLink}`} href="#top">
              {APP_NAME}
            </a>
            <p>AI agents with a face, a wardrobe and real skills. Built on Robinhood Chain. Independent project.</p>
          </div>
          {COLS.map(([h, links]) => (
            <div key={h}>
              <h4>{h}</h4>
              {links.map(([href, label]) => (
                <a key={label} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className={s.bottom}>
          <span>{APP_NAME} preview build. Credits have no monetary value.</span>
          <span>Not affiliated with Robinhood Markets.</span>
        </div>
      </div>
    </footer>
  );
}
