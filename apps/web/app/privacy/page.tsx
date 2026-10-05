import type { Metadata } from "next";
import { APP_NAME, SOCIAL } from "@orbis/shared";
import { DocPage, docStyles as s } from "@/components/DocPage";

export const metadata: Metadata = { title: `Privacy – ${APP_NAME}` };

export default function Privacy() {
  return (
    <DocPage title="Privacy" lede={<span className={s.updated}>Last updated October 4, 2026</span>}>
      <p>We collect as little as we can. This page explains what that is.</p>

      <h2>What we store</h2>
      <ul>
        <li>Your public wallet address is your account. We do not ask for your name or email.</li>
        <li>
          Your agents: their look, name, instructions, tone, skills, price, whether they are published, and the portrait made when you publish. A session
          cookie keeps you signed in for up to 7 days.
        </li>
        <li>
          Your agent&apos;s instructions are private: only you and the AI provider that generates answers can see them. People who run your published agent
          see its look, name, skills, price, rating and your shortened wallet address.
        </li>
        <li>Your credits ledger (welcome credits, runs, earnings, refunds) and the ratings you give.</li>
        <li>For each run we keep a record without its content: the agent, the skill, the price, the AI model, the number of tokens and the time.</li>
        <li>
          When you run an agent, its instructions, earlier turns of the same chat and your task are sent to our server and passed to the AI provider
          (OpenRouter and the model it routes to). Links in a task are opened by our server to read the page. We do not store your tasks or answers, and we
          do not log them.
        </li>
        <li>Our server keeps standard technical logs (such as IP address, browser and pages requested) to keep the site running and secure.</li>
        <li>
          Talking to your agent with the mic uses your browser&apos;s speech recognition. Mochibo receives only the text. Some browsers, such as Chrome and Edge, send the audio to their own
          speech service to turn it into text. Spoken answers are made by your browser on your device.
        </li>
        <li>If you set up an Autopilot, we store its task, its schedule and its last 30 results so you can read them. Only you can see them. Deleting the autopilot deletes them.</li>
        <li>We do not use advertising trackers and we do not sell personal data.</li>
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
