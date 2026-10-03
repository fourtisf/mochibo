import { fullBodyUrl } from "@/lib/images";
import s from "./Final.module.css";

const LEFT = ["kofi", "sora"];
const RIGHT = ["pip", "dara"];

export function Final() {
  return (
    <section className={s.final}>
      <div className="wrap">
        <div className={s.card}>
          <h2>Your first agent is one click away.</h2>
          <p>Free to build during the preview. No card, no email.</p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#studio">
              Start building free
            </a>
            <a className="btn btn-glass" href="#discover">
              Explore agents
            </a>
          </div>
          <div className={s.lineup}>
            {LEFT.map((id) => (
              <img key={id} alt="" src={fullBodyUrl(id)} loading="lazy" decoding="async" />
            ))}
            <img className={s.mascot} alt="Mochibo" src="/brand/mochibo-wave.webp" loading="lazy" decoding="async" />
            {RIGHT.map((id) => (
              <img key={id} alt="" src={fullBodyUrl(id)} loading="lazy" decoding="async" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
