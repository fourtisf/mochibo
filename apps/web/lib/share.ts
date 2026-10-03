"use client";
import { useEffect, useState } from "react";
import { APP_DISPLAY_HOST } from "@orbis/shared";
import { PUBLIC_ENV, appBaseUrl } from "./env";
import { slugify } from "./format";
import { usePreview } from "./preview/store";

/**
 * Public links carry only the agent's slug, never its config or instructions (CLAUDE.md 5.7).
 * Phase 1 has no saved agents, so the slug is a placeholder made from the name; phase 2
 * uses the slug the API assigns.
 */
export function useShareLinks() {
  const { agent } = usePreview();
  const [base, setBase] = useState(PUBLIC_ENV.appUrl.replace(/\/$/, "") || `https://${APP_DISPLAY_HOST}`);
  useEffect(() => setBase(appBaseUrl()), []);
  const slug = slugify(agent.name);
  const shareLink = `${base}/a/${slug}`;
  const embedCode = `<iframe src="${base}/embed/${slug}" width="460" height="560" style="border:0;border-radius:24px"></iframe>`;
  const shareShort = `${base.replace(/^https?:\/\//, "")}/a/${slug}`;
  return { slug, shareLink, embedCode, shareShort };
}
