#!/usr/bin/env node
/*
 * Build-time pre-render of the 12 base characters.
 *
 * Bundles src/render-entry.ts with esbuild, loads it in headless Chromium
 * (playwright-core, software WebGL via SwiftShader), renders a portrait
 * (320x360) and a full-body image (320x400) for every character, and writes
 * apps/web/public/characters/<id>.webp and <id>-full.webp.
 *
 *   pnpm --filter @orbis/characters render
 *
 * Env: CHROMIUM_PATH overrides the Chromium executable.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const outDir = resolve(pkgRoot, "../../apps/web/public/characters");

const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
].filter(Boolean);

const GL_FLAG_SETS = [
  ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
];

function fail(msg) {
  process.stderr.write(`render-characters: ${msg}\n`);
  process.exit(1);
}

async function bundle() {
  const res = await build({
    entryPoints: [resolve(pkgRoot, "src/render-entry.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    write: false,
    minify: true,
    logLevel: "silent",
  });
  return res.outputFiles[0].text;
}

async function hasWebGL(page) {
  return page.evaluate(() => {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });
}

async function main() {
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  if (!executablePath) fail(`no Chromium found. Set CHROMIUM_PATH. Tried: ${CANDIDATES.join(", ")}`);

  const js = await bundle();
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;

  let browser = null;
  let page = null;
  for (const args of GL_FLAG_SETS) {
    browser = await chromium.launch({ executablePath, args });
    page = await browser.newPage();
    if (await hasWebGL(page)) break;
    await browser.close();
    browser = null;
  }
  if (!browser || !page) fail("WebGL is not available in headless Chromium with any of the tried flag sets.");

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setContent(html, { waitUntil: "load" });
  const results = await page.evaluate(() => (window.__renderAll ? window.__renderAll() : null));
  if (!results) {
    await browser.close();
    fail(`render entry did not load. ${errors.join(" | ")}`);
  }
  // Count visible pixels of every image so a blank render fails the build.
  const coverage = await page.evaluate(async (urls) => {
    const out = [];
    for (const url of urls) {
      if (!url) { out.push(0); continue; }
      const img = new Image();
      img.src = url;
      try { await img.decode(); } catch { out.push(0); continue; }
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
      out.push(n / (c.width * c.height));
    }
    return out;
  }, results.flatMap((r) => [r.portrait, r.full]));
  await browser.close();

  mkdirSync(outDir, { recursive: true });
  const written = [];
  const bad = [];
  results.forEach((r, i) => {
    for (const [j, suffix, url] of [[0, "", r.portrait], [1, "-full", r.full]]) {
      const name = `${r.id}${suffix}.webp`;
      const m = /^data:image\/webp;base64,(.+)$/.exec(url || "");
      const buf = m ? Buffer.from(m[1], "base64") : null;
      const cov = coverage[i * 2 + j];
      // A real character covers a good part of the frame; under 2% means a blank render.
      if (!buf || !buf.length || cov < 0.02) {
        bad.push(`${name} (${buf ? `${buf.length} bytes, ${(cov * 100).toFixed(1)}% visible` : "no WebP data"})`);
        continue;
      }
      writeFileSync(resolve(outDir, name), buf);
      written.push({ name, size: buf.length, cov });
    }
  });

  const total = written.reduce((s, f) => s + f.size, 0);
  const kb = (n) => (n / 1024).toFixed(1) + " KB";
  process.stdout.write(`Wrote ${written.length} files to ${outDir} (${kb(total)} total)\n`);
  for (const f of written) process.stdout.write(`  ${f.name.padEnd(18)} ${kb(f.size).padStart(9)}  ${(f.cov * 100).toFixed(0)}% visible\n`);
  if (bad.length) fail(`empty or blank images: ${bad.join(", ")}`);
  if (written.length !== results.length * 2) fail(`expected ${results.length * 2} files, wrote ${written.length}`);
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));
