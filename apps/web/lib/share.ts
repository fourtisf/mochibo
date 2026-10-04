"use client";
import { useEffect, useState } from "react";
import { APP_DISPLAY_HOST } from "@orbis/shared";
import { PUBLIC_ENV, appBaseUrl } from "./env";
import { usePreview } from "./preview/store";

/**
 * Public links carry only the agent's slug, never its config or instructions (CLAUDE.md 5.7).
 * The slug comes from the API; until the agent is published there is no link to share.
 */
export function useShareLinks() {
  const { agent } = usePreview();
  const [base, setBase] = useState(PUBLIC_ENV.appUrl.replace(/\/$/, "") || `https://${APP_DISPLAY_HOST}`);
  useEffect(() => setBase(appBaseUrl()), []);
  const slug = agent.published ? agent.slug : null;
  if (!slug) return { slug: null, shareLink: "", embedCode: "", shareShort: "" };
  const shareLink = `${base}/a/${slug}`;
  const embedCode = `<iframe src="${base}/embed/${slug}" width="460" height="560" style="border:0;border-radius:24px"></iframe>`;
  const shareShort = `${base.replace(/^https?:\/\//, "")}/a/${slug}`;
  return { slug, shareLink, embedCode, shareShort };
}
