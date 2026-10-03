import s from "./Faq.module.css";

const QA = [
  ["Do the agents actually do the work?", "Yes, when an AI provider is connected on the server. Without one, every skill returns a clearly labelled sample so you can try the whole flow."],
  ["Why Robinhood Chain?", "Fast, cheap settlement for small payments, USDG for top-ups and claims, and tokenized stocks for holder rewards, all on one chain."],
  ["How do I sign in?", "Connect a wallet and sign a message. No email or password. Your agents and history belong to that wallet."],
  ["Can people see my instructions?", "No. Others see your character and skills when they run your agent, never your instructions."],
  ["How do top-ups and claims work?", "Top up credits with USDG. Earnings collect in your ledger and you claim them back to your wallet in USDG."],
  ["What happens if a run fails?", "The runner gets their credits back automatically and the creator is not paid for that run."],
  ["Can I bring my own 3D model?", "Not yet. Every character is built from parts in the studio. Custom models are on the roadmap."],
] as const;

export function Faq() {
  return (
    <section id="faq">
      <div className={`wrap ${s.faq}`}>
        <div className="head">
          <h2>Questions, answered.</h2>
          <p>Anything else, ask us on X or Telegram.</p>
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
