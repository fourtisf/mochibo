# Phase 1 notes: port the frontend

Status: done. The prototype is now a Next.js 14 app in a pnpm monorepo, with the 3D engine in its own package and pre-rendered character images. Everything still runs on placeholder data and in-browser state. Phases 2 and 3 replace that.

## What was built

| Path | What it is |
| --- | --- |
| `packages/shared` | Config constants (`APP_NAME`, limits, economics, holder tiers, reward sample rate), the 12 base characters, palettes and chip options, the `CharacterConfig` zod schema (strict, `#RRGGBB` colors), skills, templates, powers, motions, and the agent draft schema for phase 2. |
| `packages/characters` | The 3D engine ported from the prototype as TypeScript modules. Framework-agnostic, and safe to import during SSR. API: `createStage`, `stage.addActor`, `actor.setConfig`, `actor.play`, `actor.setExpression`, `stage.power`, `stage.snapshot`, `stage.dispose`, `renderThumbnail`. |
| `packages/characters/scripts/render-characters.mjs` | Build-time pre-render of the 12 portraits and 12 full-body images to `apps/web/public/characters/*.webp` (Playwright and Chromium). |
| `apps/web` | Next.js App Router app. `/` is the full landing page (hero, bento, studio, discover, creators, rewards, FAQ, final CTA, footer). `/embed/[slug]` shows only the 3D stage. |
| `scripts/visual-check.mjs` | Screenshots the prototype and the app at 1440 px and 390 px and fails if the app logs console errors. |

### Styling

`apps/web/app/globals.css` holds the design tokens (CSS variables), the reset, and the primitives every section shares: buttons, chips, swatches, inputs, glass, windows, portrait frame, power dock, toast and dialog. Each section has its own CSS Module. Values are copied 1:1 from the prototype.

### Fonts

Both fonts are self-hosted through `next/font`:

- Bricolage Grotesque comes from `next/font/google` with the `opsz` axis. It is downloaded at build time, so the build machine needs internet access.
- Geist comes from the official `geist` package, because Next 14's Google font list does not include it.

### 3D

- **Loading.** Stage components load with `next/dynamic({ ssr: false })`. The hero stage is created two animation frames after mount, so the hero text paints first. `three.js` (about 530 KB) is in a lazy chunk and is not part of the 126 KB first load.
- **Low-power mode.** It is on for touch devices, widths up to 880 px, or 4 or fewer CPU cores. It caps pixel ratio at 1.5, turns off shadow maps, uses `MeshStandardMaterial`, and the hero shows only the middle character.
- **Off-screen stages** stop rendering (IntersectionObserver). All stages share one requestAnimationFrame loop, which stops when the last stage is disposed.
- **Dispose** removes listeners and frees geometries, materials, the bot-face textures, the environment map and the WebGL context. It never disposes the shared cached textures.

## How it was verified

- **`pnpm check`** passes: `tsc --noEmit`, lint and tests in all three packages. Unit tests cover the schemas and tiers, the engine builder (all 12 characters, low-power materials, dispose without touching the cached textures), SSR-safe import, and web helpers.
- **Engine renders are byte-identical to the prototype.** The prototype's own `thumbFor` and the new `renderThumbnail` were run in the same Chromium, and all 24 images matched with 0 differing bytes.
- **Layout matches at every breakpoint.** Bounding boxes of 50 landmark elements (sections, headings, windows, cards, tiles, rows) were compared between the prototype and the app at widths 1440, 1100, 1024, 880, 768, 600, 390 and 360, using the same fonts. All are identical.
- **Interactive flows were driven in Chromium and produced no console errors**, in both production and dev mode. The flows were:
  - roster, style, gear and randomize
  - mind: name, template, tone
  - skills, including the 4-skill limit
  - a studio run with its animation and sample answer
  - publish, the "Yours" card and the free test run
  - the market run modal and the category filter
  - credits top-up, the mock wallet and the rewards calculator
  - keys 1 to 6
  - the embed page and its 404
  - framing headers

## How to run

```bash
pnpm install
pnpm dev                    # http://localhost:3000
pnpm check                  # typecheck + lint + tests
pnpm build && pnpm start    # production build

# Regenerate character images after changing the engine or a base character:
pnpm render:characters      # needs Chromium; set CHROMIUM_PATH if it is not at the default path

# Visual parity against the prototype (with the app running):
node scripts/visual-check.mjs http://localhost:3000 .visual
```

Env vars used so far, all optional:

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Base URL for share and embed links. Defaults to the current origin. |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | Shows the token address in Rewards. Empty shows "Coming soon". |
| `NEXT_PUBLIC_PREVIEW_CREDITS` | Set to `false` to hide the +100 / +500 / +1,000 buttons. |

## Still placeholder (by design, for later phases)

Everything below is isolated so the swap stays local.

- **`apps/web/lib/placeholder.ts`**: Discover agents, the leaderboard, metrics, hero card texts and the bento earnings chart. Delete it in phase 3 and read `/discover`, `/leaderboard` and `/stats` instead.
- **`apps/web/lib/preview/store.tsx`** (the only file to change in phase 2):
  - credits, the ledger, the studio agent and the "Saving…/Saved" debounce
  - the mock wallet (random address)
  - the publish simulation (`setInterval` fake runs)
- **`apps/web/lib/preview/run.ts` and `sample.ts`**: runs return the clearly labelled sample answer. The browser never calls an AI provider. Phase 3 replaces the body of `run()` with `POST /runs` and the SSE stream.
- **Share and embed links** carry only a slug, never the config or instructions. Phase 1 has no saved agents, so the slug is made from the agent name and the link does not resolve yet. `/embed/[slug]` currently resolves the 12 base character ids (for example `/embed/pip`).
- **CSP.** Only `frame-ancestors` is set: `*` on `/embed/*`, `'self'` plus `X-Frame-Options: SAMEORIGIN` elsewhere. The full strict CSP comes with the API in phase 2.

## Deliberate differences from the prototype

- **Mobile and 4-core devices show one hero character**, as the brief's low-power rule requires. The prototype shows three everywhere.
- **The credits pill** is a div with a button inside. The prototype nested its +100 buttons inside a `<button>`, which is invalid HTML.
- **Images load from files.** The hero card avatar, roster, Discover, leaderboard and final lineup use the pre-rendered WebP files instead of rendering in the browser on load. The bento portrait starts from the pre-rendered image and only re-renders in the browser after the first change.
- **Small fixes:** a favicon (the logo mark) was added, and holder tiers, fees and limits now come from `packages/shared/src/config.ts` instead of being hardcoded.

## Open questions and things to check

1. **Copy (owner).** The bento tile still says "Your whole agent fits in one link." In production the link carries only the slug, and the agent loads from the server. The sentence is still roughly true, but the owner may want new wording.
2. **Performance on real hardware (Michael).** The 50 fps target and the mid-range Android check need real devices. The test container only has a software GPU. Use Chrome DevTools > Performance on the hero and the studio.
3. **Low-power threshold.** A 4-core laptop gets low-power mode, including the single hero character. If that turns out too strict, change `isLowPowerDevice()` in `packages/characters/src/quality.ts`.
4. **pnpm warning.** pnpm warns about an ignored build script (`unrs-resolver`, used by the lint resolver). Lint works without it. Run `pnpm approve-builds` if you want it gone.
