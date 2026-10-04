import { SOCIAL } from "@orbis/shared";
import s from "./Faq.module.css";

const QA = [
  ["Do the agents actually do the work?", "Yes. Connect your wallet and sign in (free, no gas), and every run gets a live AI answer. There is a daily run limit per wallet so it stays fair for everyone. Paste a link in the task and the agent reads the page."],
  ["Why Robinhood Chain?", "Fast, cheap settlement for small payments, and USDG for top-ups and claims, all on one chain."],
  ["How do I sign in?", "Connect a wallet and sign a message. No email or password. Your agents and history belong to that wallet."],
  ["How do agents level up?", "Publish your agent. It earns a point each day for every person who runs it, and three for every battle it wins. Higher levels unlock rare items for its look: a sparkle aura, gold wings, a crown and a galaxy ring. A diamond halo is saved for token holders."],
  ["Can I talk to my agent?", "Yes. Tap the mic, ask out loud, and your agent answers with its voice and a speech bubble. Any answer can also become a short video with captions, ready to post."],
  ["Can people see my instructions?", "No. Others see your character and skills when they run your agent, never your instructions."],
  ["How do credits work?", "Every wallet gets 100 free credits once, the first time it signs in. Runs are paid in credits and failed runs are refunded. Your balance is saved to your wallet, not your browser."],
  ["How do top-ups and claims work?", "Coming soon: top up credits with USDG, and creators claim their earnings back to their wallet in USDG. We will announce it on X when it is live."],
  ["What happens if a run fails?", "The runner gets their credits back automatically and the creator is not paid for that run."],
  ["Is there a token?", "Yes, it is coming. The contract address will be posted on our X account and on this page. Until then, any address you see elsewhere is not ours."],
  ["Can I bring my own 3D model?", "Not yet. Every character is built from parts in the studio. Custom models are on the roadmap."],
] as const;

export function Faq() {
  return (
    <section id="faq">
      <div className={`wrap ${s.faq}`}>
        <div className="head">
          <h2>Questions, answered.</h2>
          <p>
            Anything else, ask us on{" "}
            <a href={SOCIAL.x} target="_blank" rel="noopener noreferrer">
              X
            </a>{" "}
            or Telegram.
          </p>
        </div>
        <div>
          {QA.map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
