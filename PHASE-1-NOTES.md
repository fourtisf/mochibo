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
| `NEXT_PUBLIC_PREVIEW_CREDITS` | Set to `true` to show free +100 / +500 / +1,000 buttons (local testing only; off by default since October 4, 2026). |

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

## Update: preview honesty pass and brand (after the first deploy)

- **Name.** The site is now Mochibo: `APP_NAME`, `APP_DISPLAY_HOST` and `TOKEN_SYMBOL` in `packages/shared/src/config.ts`.
- **Brand.** There is a new mascot logo in the nav, favicon, Apple icon and link preview (Open Graph/Twitter) image. Brand files are in `brand/`.
- **No invented numbers.**
  - The home metrics show product facts (12 characters, 8 skills, 500 CR max price, 5% fee) until `/stats` exists.
  - The leaderboard shows an empty state.
  - Discover cards are labelled "Example" without fake runs or ratings.
  - The fake incoming runs after publishing were removed.
- **No unbuilt promises.**
  - The hero pill now says "Preview is live".
  - Holders shows fee tiers and the CA ("Coming soon" until `NEXT_PUBLIC_TOKEN_ADDRESS` is set). The hourly stock rewards calculator was removed.
  - The FAQ no longer mentions stock rewards.
- **Links.**
  - X goes to `SOCIAL.x` (nav, footer, FAQ).
  - Dead footer links (Whitepaper, Telegram, GitHub) were removed.
  - New pages: `/roadmap`, `/terms` and `/privacy`.
- **SEO.** Added `robots.txt` (embeds excluded) and `sitemap.xml`.
- **Open for the owner and Michael:** the Terms and Privacy pages are plain-language preview versions. Have a lawyer review them before paid credits or the token go live.

## Update: real wallet connect (start of phase 2)

- **RainbowKit 2 on wagmi 2 and viem 2.** The modal lists MetaMask, Coinbase, Rabby, OKX, Phantom, Trust, Rainbow, Bitget, Binance, Zerion, Brave and any wallet that announces itself (EIP-6963), each with its logo. It is themed to the site.
- **Lazy loading.** `components/wallet/WalletButton.tsx` is loaded lazily from the nav (`next/dynamic`, `ssr: false`), so the wallet libraries are not in the first-load bundle (home first load is about 129 KB).
- **Chain.** `lib/wallet/chain.ts` reads Robinhood Chain from `NEXT_PUBLIC_CHAIN_ID` and `NEXT_PUBLIC_RPC_URL`. The official docs were not reachable from the build environment, so nothing is hardcoded. Until the values are set, wallets connect without a network switch; the address is the same on every EVM chain.
- **WalletConnect.** `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (free at cloud.reown.com) enables mobile wallets and QR codes. Without it, browser-extension wallets still work.
- **Webpack.** `next.config.mjs` maps optional x402 peers of the Coinbase SDK to empty modules (a known wagmi 2 build issue).
- **Not done yet.** Sign-In with Ethereum (nonce, signature, session cookie) needs the Fastify API, which is the next phase 2 step. The preview mock wallet was removed.
- **VPS settings.** Public settings go in `/home/mochibo/mochibo.env` (see `deploy/README.md`) and are baked in at build time.

## Update: live AI answers (OpenRouter) and wallet sign-in

**Owner decisions (October 4, 2026)**
- The AI provider is OpenRouter instead of the Anthropic API from the brief.
- Only wallets that are connected and signed in can run agents.

**API (`apps/api`)**

Fastify 5 on Node 22, bundled to `dist/server.cjs` with esbuild.
- **Sign in.** `GET /auth/nonce`, `POST /auth/verify` and `POST /auth/logout`.
  - Sign-In with Ethereum, using viem's SIWE helpers.
  - Each nonce lives 5 minutes in Redis and can be used once.
  - Verify checks the domain, the chain id (when `CHAIN_ID` is set) and the expiry.
  - The session cookie is a random id stored in Redis. It is httpOnly, SameSite=Lax, Secure on HTTPS, and lasts 7 days.
- **`GET /me`** returns the signed-in address. **`GET /runs/status`** returns the daily usage.
- **`POST /runs`** streams the answer as Server-Sent Events.
  - The prompt is built like `liveRun()` in the prototype: the persona goes in the system prompt, the task in the user turn.
  - When web search is off, the Web research skill is told it cannot browse, and the UI says so.
- **Limits** live in Redis:
  - per minute, per wallet per UTC day, and in total per day
  - one run at a time per wallet
- **Failed runs** do not count towards the daily limit. In the browser, the preview credits are refunded.
- **CSRF.** Every write must carry `Origin` equal to `APP_URL`.
- **Logs** keep the wallet, skill, model, token counts and duration. They never include the task, the instructions or the answer.
- **Tests.** 12 tests in `src/app.test.ts`:
  - SIWE happy path, replayed nonce, wrong domain, wrong signer, missing Origin, chain id
  - streaming, validation, daily and total caps, provider failure, offline mode

**Web**
- `components/wallet/WalletButton.tsx` adds RainbowKit's authentication adapter. After connecting, the modal asks for one free signature.
  - Disconnecting or switching accounts ends the session.
  - `lib/auth.ts` shares the sign-in state with the rest of the page, so a Run click while signed out opens the wallet modal.
- `lib/preview/run.ts` streams `/api/runs` into the output. The character thinks, scans, talks while the text arrives, and cheers at the end.
  - Preview credits are debited only after the API accepts the run.
  - The canned sample answers (`sample.ts`) were removed.
- In development, Next rewrites `/api/*` to the API (`API_INTERNAL_URL`, default `http://127.0.0.1:4000`). In production, Nginx handles `/api/`.

**Deploy**
- `deploy/api-setup.sh` (run by `setup.sh` and `update.sh`):
  - creates a private Redis instance `redis-server@mochibo`
  - creates `/home/mochibo/api.env` (mode 600) and picks the API port
  - writes the Nginx snippet `/etc/nginx/snippets/mochibo-api.conf` with buffering off for streaming, and includes it in the site
- `update.sh` now pulls and re-executes its newest version, like `setup.sh`.

**Verified**
- `pnpm check` passes.
- In Chromium, with a test wallet that really signs and a fake OpenRouter:
  - a signed-out Run opens the modal
  - sign-in sets the cookie and the answer streams in
  - the 4th run of 3 allowed shows the daily-limit message and is not charged
  - the session survives a reload, and disconnect ends it
- Through a local Nginx with the generated snippet, the first streamed chunk arrived after 6 ms (not buffered).

**Open**
- The OpenRouter key and model are set by the owner in `/home/mochibo/api.env` (see `deploy/README.md`).
- OpenRouter could not be reached from the build sandbox, so the first real call happens on the VPS.
- Discover example agents use their description as instructions until real agents are stored (next phase 2 step: Postgres, agent CRUD and `{ agentId }` runs).

## Update: talking characters, English only, 100 starting credits

**Owner decisions (October 4, 2026)**
- Characters talk, and their words show in a speech bubble.
- English only: the Indonesian option and every Indonesian example were removed. `LANGUAGES` is now `["English"]`, so the studio's language field is gone.
- Visitors start with 100 preview credits (`ECONOMICS.previewStartCr`).

**Talking (`apps/web/lib/talk.ts`)**
- One `Talker` per stage splits text into sentences:
  - "3.5" and "e.g" do not end a sentence.
  - Bullets and markdown are removed.
  - Long sentences are cut at about 150 characters.
- Each sentence:
  - shows in a bubble (`components/SpeechBubble.tsx`) that follows the head through the new engine method `stage.screenPoint(actor)`
  - opens the mouth (`actor.talking`)
  - is read aloud with the browser's built-in Web Speech API: free, no new service, nothing leaves the device
- Voice:
  - Each character has a steady voice: bots are higher and a little faster, humans vary by look.
  - With voice off, or no English voice on the device, each sentence stays up for a reading time.
  - The speaker button in the studio tools turns voice off; the choice is saved in this browser.
  - Only one stage speaks at a time.
- **Studio:** live answers are spoken while they stream in.
- **Hero:** tapping a character makes it introduce itself, with a new line on each tap.
- **Mobile Safari:** it only allows speech that starts inside a tap, so the Run click "unlocks" speech first.

**Copy changes**
- Discover: "Bahasa Bridge" became "Lingo Bridge" (Spanish, French, Japanese and more).
- The "Bahasa bridge" template became "Translator".
- The Bento pill now reads "English".
- The hero task card says "English to Spanish".
- `brand/x-article.md` no longer lists an answer language.
- The brief (CLAUDE.md, section 1) still says "English, Indonesian". That brief text is the owner's to update.
