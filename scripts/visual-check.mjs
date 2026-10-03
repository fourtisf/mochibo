#!/usr/bin/env node
/**
 * Visual parity check: screenshots the approved prototype and the running app at desktop
 * (1440) and mobile (390) widths, and reports console errors from the app.
 *
 *   pnpm build && pnpm start            # in another terminal (or `pnpm dev`)
 *   node scripts/visual-check.mjs [appUrl] [outDir]
 *
 * three.js r128 for the prototype is served from node_modules, so only Google Fonts needs
 * the network. Set CHROMIUM_PATH to use a specific Chromium build.
 */
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appUrl = process.argv[2] || "http://localhost:3000";
const outDir = resolve(process.argv[3] || join(root, ".visual"));
mkdirSync(outDir, { recursive: true });

const require = createRequire(join(root, "packages/characters/package.json"));
const threeMin = readFileSync(join(dirname(require.resolve("three/package.json")), "build/three.min.js"));

const exe = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({
  executablePath: existsSync(exe) ? exe : undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "<-loopback>,localhost,127.0.0.1" } : undefined,
});

const sizes = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];
const targets = [
  ["prototype", pathToFileURL(join(root, "prototype/orbis-agent-studio-v2.html")).href],
  ["app", appUrl],
];

let appErrors = 0;
for (const [sizeName, vp] of sizes) {
  for (const [name, url] of targets) {
    const { width, height, ...rest } = vp;
    const ctx = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true, reducedMotion: "reduce", ...rest });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("**/three.js/r128/three.min.js", (r) => r.fulfill({ body: threeMin, contentType: "application/javascript" }));
    // Fetch Google Fonts with curl so the prototype renders with its real fonts behind proxies.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => {
      try {
        const body = execFileSync("curl", ["-sS", "--max-time", "20", "-A", r.request().headers()["user-agent"].replace("HeadlessChrome", "Chrome"), r.request().url()]);
        const css = r.request().url().includes("googleapis");
        r.fulfill({ body, contentType: css ? "text/css" : "font/woff2", headers: { "access-control-allow-origin": "*" } });
      } catch {
        r.abort();
      }
    });
    // Desktop parity runs at full quality; the engine drops to low-power on <= 4 cores.
    if (sizeName === "desktop") await page.addInitScript(() => Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 }));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
    // Scroll through so lazy images and observers fire, then let the 3D settle.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const file = join(outDir, `${sizeName}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`${sizeName} ${name}: ${file}${errors.length ? `\n  console errors:\n  - ${errors.join("\n  - ")}` : ""}`);
    if (name === "app") appErrors += errors.length;
    await ctx.close();
  }
}
await browser.close();
if (appErrors) {
  console.error(`App logged ${appErrors} console error(s).`);
  process.exit(1);
}
