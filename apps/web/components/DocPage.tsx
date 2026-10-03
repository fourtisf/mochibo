import type { ReactNode } from "react";
import { APP_NAME, SOCIAL } from "@orbis/shared";
import { Footer } from "./Footer";
import heroStyles from "./Hero.module.css";
import s from "./DocPage.module.css";

/** Simple content page (roadmap, terms, privacy) in the site's look. */
export function DocPage({ title, lede, children }: { title: string; lede: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className={heroStyles.aurora} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className={s.top}>
        <div className={`wrap ${s.bar}`}>
          <a className="logo" href="/">
            <img src="/brand/mochibo-head.png" alt="" width={30} height={30} />
            {APP_NAME}
          </a>
          <div style={{ display: "flex", gap: 8 }}>
            <a className={`btn btn-glass btn-sm ${s.xBtn}`} href={SOCIAL.x} target="_blank" rel="noopener noreferrer">
              Follow on X
            </a>
            <a className="btn btn-primary btn-sm" href="/#studio">
              Open the studio
            </a>
          </div>
        </div>
      </header>
      <main className={s.main}>
        <div className={`wrap ${s.doc}`}>
          <h1>{title}</h1>
          <div className={s.lede}>{lede}</div>
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}

export const docStyles = s;
