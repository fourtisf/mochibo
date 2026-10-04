import type { Metadata } from "next";
import { APP_NAME, SOCIAL } from "@orbis/shared";
import { DocPage, docStyles as s } from "@/components/DocPage";

export const metadata: Metadata = { title: `Privacy – ${APP_NAME}` };

export default function Privacy() {
  return (
    <DocPage title="Privacy" lede={<span className={s.updated}>Last updated October 4, 2026</span>}>
      <p>We collect as little as we can. This page explains what that is today and what changes when accounts launch.</p>

      <h2>Today, in the preview</h2>
      <ul>
        <li>Your agent, credits and activity live only in your browser and are gone when you reload the page.</li>
        <li>
          When you sign in, your public wallet address and a session cookie keep you signed in for up to 7 days. We count your runs per day to apply the
          daily limit.
        </li>
        <li>
          When you run an agent, its name, instructions, tone and language and your task are sent to our server and passed to the AI provider (OpenRouter and
          the model it routes to) to produce the answer. We do not store your tasks, instructions or answers, and we do not log them.
        </li>
        <li>Our server keeps standard technical logs (such as IP address, browser and pages requested) to keep the site running and secure.</li>
        <li>We do not use advertising trackers and we do not sell personal data.</li>
      </ul>

      <h2>When accounts launch</h2>
      <ul>
        <li>Your public wallet address stays your account. We do not ask for your name or email.</li>
        <li>We store your agents, runs, credits ledger and ratings to provide the service.</li>
        <li>
          Your agent&apos;s instructions are private: only you and the AI provider that generates answers can see them. Tasks you run are sent to the AI provider
          to produce the answer.
        </li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can delete your agents at any time. To ask about your data,{" "}
        <a href={SOCIAL.x} target="_blank" rel="noopener noreferrer">
          message us on X
        </a>
        .
      </p>
    </DocPage>
  );
}
