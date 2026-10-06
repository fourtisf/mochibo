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
| `NEXT_PUBLIC_TOKEN_ADDRESS` | Optional override for the token address shown in the hero and Holders. Empty uses `TOKEN_CONTRACT` in `packages/shared/src/config.ts`. |

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

## Update: real credits on the server (stage A)

**Owner decisions (October 4, 2026)**
- Credits are real and saved per wallet.
- Every wallet gets 100 free credits once, at its first sign-in.
- Free top-up buttons are gone.
- USDG top-ups (stage B) come later and need the chain values and the CreditVault audit.

**Database (PostgreSQL + Prisma 6.19, `prisma/schema.prisma`, first migration `prisma/migrations/*_init`)**

Changes to the draft schema:
- New `LedgerType.WELCOME`.
- `Lang` is `EN` only.
- `Run.agentId` is optional and `Run.source` was added ("studio", "example:<id>"), because agents are not stored yet.
- `Run.task` is optional and not filled. The privacy page promises tasks and answers are not kept.

**Ledger (`apps/api/src/ledger.ts`)**
- Balances are BigInt centi-credits.
- `applyChange` writes one append-only `LedgerEntry` with a unique idempotency key and the balance after the change, in the same transaction as the cached `User.balance`.
- A debit is a conditional update (`balance >= cost`), so it is atomic under concurrency and can never go negative.
- The welcome grant uses the key `welcome:<wallet>`, so it is paid at most once.
- `reconcile()` compares cached balances with the ledger sums. `dist/reconcile.cjs` runs it nightly from `/etc/cron.d/mochibo-reconcile` and logs to `/home/mochibo/reconcile.log`.

**Runs** follow CLAUDE.md 5.3:
- The server sets the price: `RUN_COST_CR` for your own agent, the listed price for an example agent from `@orbis/shared` `EXAMPLE_AGENTS`.
- One transaction debits the runner and creates the Run as RUNNING.
- On success, the Run is DONE with the model and token counts.
- On failure, a full `REFUND` and the Run is REFUNDED.
- Not enough credits returns 402 and does not use a daily run.
- The SSE stream reports the balance (`start`, `done`, `error`).
- Example and studio runs have no creator to pay. Creator payouts (price minus the tier fee) arrive with stored, published agents.

**API**
- `GET /me` returns the balance.
- `GET /me/ledger` returns the last 20 entries.
- Sign-in creates the user.

**Web**
- `lib/account.ts` reads the balance and ledger from the API and follows sign-in.
- The nav pill shows the server balance. Signed out, it offers "100 free credits" and a Connect wallet button.
- The Publish pane shows the server ledger.
- The browser no longer keeps any credits.
- Testing your own published agent from Discover now costs a studio run (5 CR) instead of being free, so credits cannot be bypassed.

**Tests**
- The API tests need PostgreSQL. Set `TEST_DATABASE_URL` to an empty database with the migrations applied, for example: `TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/mochibo_test pnpm check`. Without it, the API suite is skipped with a warning.
- There are 17 API tests, including: welcome once, debit and reconcile, server pricing, insufficient credits, full refund.

**Deploy**
- `api-setup.sh` installs PostgreSQL and creates the role and database. Existing databases are left alone, and it is safe to run again.
- `api-setup.sh` writes `DATABASE_URL` to `api.env` and installs the nightly check.
- `update.sh` runs `prisma migrate deploy`.
- Verified in the sandbox: the setup block twice, login with the generated password, and the migrate line from `update.sh`.

## Update: own sign-in step (fixes "Error signing message")

- **The problem.** RainbowKit's built-in SIWE step signs through wagmi's `signMessage`. Its connector checks can fail when several wallet extensions are installed or the wallet is on another chain. When they fail, RainbowKit shows only "Error signing message, please retry!".
- **The new step.** `components/wallet/WalletButton.tsx` now has its own "Verify your wallet" dialog:
  - It sends `personal_sign` straight to the connected wallet's provider, using the chain id the wallet reports.
  - It shows the wallet's real error, and says so clearly when the user cancels.
  - It logs failures to the console as `[sign-in]`.
  - It is rendered through a portal to `<body>`, because the nav's `backdrop-filter` traps fixed elements.
  - Every "connect wallet" button runs the same flow: connect, then sign.
- **API.** The API accepts the `www.` twin of `APP_URL` for SIWE domains and write Origins. Nginx serves both hosts, and requests from www were rejected with 403 before.
- **Cleanup.** Two test screenshots committed by mistake in the talking-characters commit were removed, and `/*.png` at the repo root is now ignored.

## Update: live product (saved agents, publishing, creator earnings, ops)

- **Saved agents.** Signed in, the studio loads the wallet's agents (`GET /agents/mine`) and autosaves every change after 700 ms (`PATCH /agents/:id`), with "Saving…" then "Saved". The agent switcher in the studio bar lists "My agents", makes a new one (max 20) or deletes one (soft delete). A draft changed before sign-in is saved as a new agent at sign-in.
- **Publishing.** "Publish to Discover" saves, publishes with the price, renders the portrait once in the browser and uploads it (`POST /agents/:id/thumbnail`). Share and embed links appear only once the agent is published, and carry only the slug.
- **Discover** lists published agents from `GET /discover` (newest first, categories from skills) above the example agents. Your own agents show "Yours" and cost a studio run to test.
- **Share page** `/a/[slug]` is server-rendered with OG and Twitter tags (portrait, name, skills, price). It never contains the instructions. **Embed** `/embed/[slug]` works for published agents and the 12 base characters.
- **Runs of published agents** cost the agent's price. On success the creator is credited the price minus the 5% fee (`RUN_CREDIT`); the agent's runs and earnings go up. Failed runs refund the runner and pay nothing. Runners can rate a finished run 1 to 5 stars, once.
- **Chat.** Answers are kept as a short chat. Follow-ups send the last 3 turns with the next run. "New chat" clears it. Each answer has Copy and Post to X.
- **Links.** A task with up to 2 links reads those pages first (public addresses only, checked at connect time and on every redirect; 1 MB, 8 s). X links are refused, since they need a login.
- **Landing data.** Metrics read `GET /stats` once agents are published (product facts before that), the hero earnings card shows real recent payouts, and the leaderboard reads `GET /leaderboard` (this week's creator earnings, cached 5 minutes). The "preview" labels are gone.
- **Ops.** Daily backups (14 days), a 5-minute health check that restarts a dead API, portraits served by Nginx from `/var/www/mochibo-uploads`, and security headers with the content policy in report-only mode. See `deploy/README.md`.
- **Verified** with `pnpm check` (typecheck, lint, 57 tests including 33 API tests against PostgreSQL) and a two-wallet browser test against the built app with a stand-in AI server: save, rename, reload, publish, share page without instructions, run by a second wallet (100 to 88 to 76 CR), follow-up with history, 5-star rating, creator credited 11.4 CR per run, leaderboard row, embed with `frame-ancestors *`, no console errors, and no horizontal scroll at 390 px.
- **Still needs the owner:** USDG top-ups and claims (Robinhood Chain id, RPC, USDG address, a multisig, an audit), the ORBIS token address for holder tiers, and a legal review of Terms and Privacy.


## Update: naming agents

- **Rename in place.** Click the agent's name (with the pencil) in the studio bar to rename it. Enter or clicking away saves, Escape cancels. The Name field in the Mind tab still works too.
- **Custom names stick.** Picking another character only renames the agent if it still has the default name ("My Juni" becomes "My Pip"); a name you chose is kept.
- **The link follows the name.** The public link (`/a/<name>-<6 hex>`) is made from the name at the first publish. After that it stays the same, so links already shared keep working after a rename. Covered by an API test.

## Update: talk to your agent (voice)

- **Mic button** in the studio console and in the run modal (Discover and share pages). Tap it and speak: the words fill the task box as you talk, and the run starts when you stop. Tap again to send early.
- In the studio the character reacts (waves, looks surprised while listening, happy when it heard you) and reads the answer aloud with the speech bubble, as before.
- Uses the browser's speech recognition (`apps/web/lib/listen.ts`), free and keyless. Chrome, Edge and Safari support it; the button hides where it is missing (Firefox). Chrome and Edge transcribe on their own speech service, which the Privacy page now says. `Permissions-Policy` allows the microphone for the site itself only.
- Clear messages when the mic is blocked, missing, or nothing was heard.
- **Mobile fix (old bug):** on phones the studio's tab row and motion chips forced the studio 89 px wider than the screen, cutting off the Publish tab and the Run button. The grid columns are now `minmax(0, 1fr)` so those rows scroll instead.

## Update: answer as video

- **"Make video"** sits next to Copy and Post to X on every finished answer (studio, Discover, share pages). It records a 720x1280 vertical clip of the agent saying the answer: the agent's name, the question, the 3D character waving, talking and gesturing, one caption per sentence, and a closing card "Build your own agent at mochibo.studio".
- All in the browser, no server cost: a hidden 3D stage renders the character, `lib/video.ts` draws each frame with the captions, and `MediaRecorder` records the canvas. MP4 where the browser can (Chrome 126+, Edge, Safari), WebM otherwise. Download, or Share on phones.
- Clips are silent (browsers cannot record their own speech voice) and capped at 40 seconds; longer answers are cut at a sentence.
- The engine got three stage options for this: `pixelRatio`, `pauseOffscreen` and `trackPointer`, plus an `onFrame` callback that runs right after each render.

## Update: agent levels and rare items

- **XP.** An agent gets 1 point per other wallet per day that runs it (a Redis key per agent, runner and UTC day stops one wallet from farming), and 3 per battle win (next update). Stored as `Agent.xp` (migration `20261005090000_levels`). Levels: 0, 5, 15, 40, 100, 250 points for levels 1 to 6 (`packages/shared/src/levels.ts`).
- **Rare items.** Sparkle aura (level 2), Gold wings (3), Crown (4), Galaxy ring (5), and a Diamond halo for token holders (shown locked until the token address is set). They are new values of the existing `hat` and `back` fields, so `CharacterConfig` keeps the same keys; the base characters and `CHIPS` are unchanged.
- **Enforced by the API.** Creating or saving a look with a locked item returns 403 `locked` with a readable message. The studio shows locked items with a lock and the level they need, and "Item locked" in the save label if it ever happens.
- **Studio.** A "Rare items" section in the Gear tab with a level bar and the next unlock, a level badge in the studio bar, and a level-up celebration (toast, cheer, confetti) the first time the creator sees a higher level. Discover cards and share pages show the level.
- **Engine.** New geometry for the five items in `builder.ts`; the aura twinkles and the galaxy ring spins in `actor.ts`.

## Update: Agent Battle

- **What it is.** A new "Agent Battle" section on the home page (and "Battle" in the nav). Pick two agents (your own, any published agent, or an example), a mode (Roast battle, or Bull vs bear with a hot take to argue) and an optional theme. Both characters stand on one 3D stage and take turns, three lines each, with voices, speech bubbles, gestures and reactions. People vote for 24 hours; the winner dances.
- **Money and levels.** Starting a battle costs `BATTLE_COST_CR` (15), debited up front with a ledger entry; if the AI fails, it is refunded in full. When voting ends, `settleDue()` (every minute in the API, and on page views) closes the battle: the winning stored agent gets 3 XP and a battle win, and its creator gets `BATTLE_PRIZE_CR` (5) once (`battle:<id>:prize`). Ties and example agents pay nothing. Limits: 5 battles per wallet per day, 100 in total, one at a time per wallet.
- **Privacy.** Each fighter's instructions go only into its own system prompt. The battle stores names, looks and the public lines, never instructions (covered by a test).
- **Pages.** `/b/[slug]` replays a battle (Play battle), shows votes and time left, and has Copy link and Post to X, with OG tags for link previews. The landing section lists recent battles and the top fighters.
- **API.** `POST /battles` (SSE: start, line, delta, lineEnd, done, error), `GET /battles`, `GET /battles/top`, `GET /battles/status`, `GET /battles/:slug`, `POST /battles/:slug/vote`. Migration `20261005100000_battles` (tables `Battle`, `BattleVote`, `Agent.battleWins`, three ledger types).
- **Talker.** `whenIdle()` lets the arena wait for a line to be said. Devices without an English voice now show each sentence for a reading time instead of waiting on a silent voice.

## Update: Autopilot (agents that run on their own)

- **What it does.** A new Autopilot tab in the studio. Give your agent a task, a skill and a schedule (every 6 hours, daily or weekly at a time you pick, shown in your own time zone) and it runs by itself. Results land in the tab with Copy and Post to X; a dot on the tab shows new results. Run now, pause and delete per schedule; up to 5 per wallet; the last 30 results per autopilot are kept. Links in a task are read on every run, so an autopilot can watch a page.
- **Money.** Every run goes through the same core as a normal run (`apps/api/src/run-core.ts`, now shared by `POST /runs`): server-side price, daily limits, `RUN_DEBIT`, creator payout for published agents, full `REFUND` on failure. Out of credits, a deleted or unpublished agent, or 3 failures in a row pause the autopilot with a reason.
- **Scheduler.** Inside the API process, every minute (`runDueAutopilots`). A run is claimed by moving `nextRunAt` with a conditional update, so it can never run twice. Times are stored as minutes after midnight UTC plus a UTC weekday (`nextRunAfter` in `packages/shared/src/autopilot.ts`).
- **Privacy.** Tasks and results are visible to the owner only (covered by a test) and are listed on the Privacy page.
- **API.** `GET/POST /autopilots`, `PATCH/DELETE /autopilots/:id`, `POST /autopilots/:id/run`, `GET /autopilots/results`, `POST /autopilots/results/read`. Migration `20261005150000_autopilot`.
- **Refactor.** The run logic moved from `runs.ts` into `run-core.ts` unchanged; all existing run tests pass against it.
