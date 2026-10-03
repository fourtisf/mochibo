import type { MetadataRoute } from "next";
import { APP_DISPLAY_HOST } from "@orbis/shared";

const base = (process.env.NEXT_PUBLIC_APP_URL || `https://${APP_DISPLAY_HOST}`).replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/roadmap", "/terms", "/privacy"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p ? 0.5 : 1 }));
}
