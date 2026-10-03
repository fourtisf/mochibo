import { APP_NAME, SOCIAL } from "@orbis/shared";
import s from "./Footer.module.css";

type Link = readonly [href: string, label: string];
const COLS: readonly (readonly [string, readonly Link[]])[] = [
  ["Product", [["/#studio", "Studio"], ["/#discover", "Discover"], ["/#features", "Skills"], ["/#rewards", "Holders"]]],
  ["Learn", [["/#faq", "FAQ"], ["/#creators", "For creators"], ["/roadmap", "Roadmap"]]],
  ["Community", [[SOCIAL.x, "X"], ...(SOCIAL.telegram ? ([[SOCIAL.telegram, "Telegram"]] as const) : [])]],
];

const ext = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

export function Footer() {
  return (
    <footer className={s.footer}>
      <div className="wrap">
        <div className={s.foot}>
          <div>
            <a className={`logo ${s.logoLink}`} href="/#top">
              {APP_NAME}
            </a>
            <p>AI agents with a face, a wardrobe and real skills. Built on Robinhood Chain. Independent project.</p>
          </div>
          {COLS.map(([h, links]) => (
            <div key={h}>
              <h4>{h}</h4>
              {links.map(([href, label]) => (
                <a key={label} href={href} {...ext(href)}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className={s.bottom}>
          <span>{APP_NAME} preview build. Credits have no monetary value.</span>
          <span className={s.legal}>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <span>Not affiliated with Robinhood Markets.</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
