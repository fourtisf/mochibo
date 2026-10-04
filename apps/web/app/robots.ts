import type { MetadataRoute } from "next";
import { APP_DISPLAY_HOST } from "@orbis/shared";

const base = (process.env.NEXT_PUBLIC_APP_URL || `https://${APP_DISPLAY_HOST}`).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/embed/", "/api/"] }], sitemap: `${base}/sitemap.xml` };
}
