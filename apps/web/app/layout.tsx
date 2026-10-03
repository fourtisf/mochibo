import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { APP_NAME } from "@orbis/shared";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-bricolage",
});

export const metadata: Metadata = {
  title: `${APP_NAME} – AI agents with a face, a wardrobe and a job`,
  description:
    "Design a 3D character, give it a personality and real skills, then run it, share it or publish it. Every time someone runs your agent, you earn.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#100D26",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${GeistSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
