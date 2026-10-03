# Orbis Agent Studio: production build brief

Orbis is a working name. The final brand and domain are not decided yet, so keep the name in one config constant.

This file is the brief for Claude Code. The owner is ALFA (founder, non-coder). Production implementation is reviewed and deployed by Michael (developer). Write code and notes so Michael can review them quickly.

## 0. How to work on this project

- `prototype/orbis-agent-studio-v2.html` is the approved prototype and the source of truth for UI, UX, copy and the 3D characters. Port it. Do not redesign it.
- Match the prototype visually on desktop (1440px) and mobile (390px). Same colors, fonts, spacing, radii, copy and motion.
- Work in the phases in section 12. Finish and verify one phase before starting the next. At the end of each phase, write a short `PHASE-N-NOTES.md` listing what was built, how to run it, and anything left open.
- Ask before you change the stack, change the design, add a paid third-party service, or deploy a smart contract to mainnet.
- Never put secrets in frontend code, in git, or in logs. The server must never hold a key that can move user funds directly (see section 8).
- Run `tsc --noEmit`, lint and tests before you call a phase done.

### Design rules the owner cares about

- Keep the dark indigo palette from the prototype. Do not switch to a white or light background, and do not use a black and gold color scheme.
- Keep the premium look: Bricolage Grotesque for display, Geist for UI text, glass panels, the noise overlay, the hero aurora.
- No all-caps eyebrow labels, no arrows appended to button text. Copy stays in English and in the prototype's plain, direct tone.

## 1. What the product is

Users build AI agents that have a 3D character body.

1. Pick one of 12 cute chibi characters (8 humans, 4 bots).
2. Style it: skin, 8 hair styles, hair and eye color, face extras, 4 outfits, colors, hats, glasses, back items (wings, cape, jetpack, backpack), a floating buddy, glow color.
3. Give it a mind: name (max 32 chars), instructions (max 2,000 chars), tone (Friendly, Professional, Concise), answer language (English, Indonesian).
4. Equip up to 4 of 8 skills: Web research, Content writer, Document Q&A, Summarizer, Translator, Idea generator, Code explainer, Task planner.
5. Run tasks. The character animates while it works (think, scan, talk, cheer).
6. Publish to Discover with a price per run (0 to 500 credits). Others pay per run. The creator gets the price minus a platform fee. Failed runs are refunded.
7. Share an agent as a link or embed it on any website with an iframe.
8. Credits are topped up with USDG on Robinhood Chain. Creators claim earnings back to their wallet in USDG.
9. Holders of the ORBIS token get lower creator fees (tiers) and, later, hourly rewards paid in tokenized stock. Rewards are feature-flagged and come last.

## 2. Stack (fixed, this is the owner's standard production stack)

- Frontend: Next.js 14 (App Router), React 18, TypeScript. Port the prototype CSS into CSS Modules plus one global stylesheet that holds the design tokens as CSS variables. Do not rebuild the styling in a different design system.
- 3D: three.js pinned to `0.128.0` for the first release, because the prototype uses the r128 API (`outputEncoding`, `sRGBEncoding`, `MeshPhysicalMaterial` with `clearcoat`). If you upgrade later, handle the color management changes (`outputColorSpace`, `SRGBColorSpace`) and the light intensity changes, and re-check the look against the prototype.
- Backend: Fastify (Node 20 LTS), Prisma, PostgreSQL, Redis. Use BullMQ on Redis for background jobs (chain indexer, reconciliation, leaderboard).
- Wallet and chain: wagmi and viem, Sign-In with Ethereum (EIP-4361) on Robinhood Chain.
- AI: Anthropic API, called only from the Fastify server. Model name comes from env.
- Contracts: Foundry, Solidity 0.8.24, OpenZeppelin.
- Hosting: Hostinger VPS, PM2, Nginx, Let's Encrypt.

## 3. Repository layout

```
/apps/web                 Next.js app (landing, studio, discover, agent pages, embed)
/apps/api                 Fastify API + workers
/packages/characters      3D engine ported from the prototype (framework-agnostic TS)
/packages/shared          Types, zod schemas, skill definitions, constants
/contracts                Foundry project (CreditVault, later RewardsDistributor)
/prisma/schema.prisma     Draft schema (see section 6)
/prototype                The approved HTML prototype, read-only reference
/deploy                   PM2 ecosystem file, Nginx config, backup scripts
.env.example
```

## 4. Porting the prototype

The prototype script is split into labelled sections. Map them like this:

| Prototype section | Goes to |
| --- | --- |
| CONFIG | `packages/shared/config.ts` plus env vars |
| DATA (CHARS, PAL, CHIPS, SKILLS, TEMPLATES) | `packages/shared` (skills and templates also seeded in DB if needed) |
| MARKET, LEADERS, metrics numbers | Delete. Replace with real API data. |
| TEXTURES, MATERIALS + GEOMETRY HELPERS, CHARACTER BUILDER, MOTIONS, ENVIRONMENT, ACTOR + STAGE | `packages/characters` as TS modules |
| THUMBNAILS | `packages/characters/thumbnail.ts` (client) plus the build script below |
| AI RUN, sample() | Server: `apps/api/src/runs`. Remove the browser call to api.anthropic.com. |
| UI HELPERS, HERO, STUDIO PANELS, DISCOVER, BENTO, REWARDS | React components in `apps/web` |

### Character config

Define one zod schema `CharacterConfig` with exactly these fields and enums (copy the allowed values from `CHIPS` and the defaults from `DEF` in the prototype):

`kind ("human" | "bot"), skin, hair, hairC, eyeC, mouth, blush, freckles, lashes, top, topC, bottomC, shoeC, accC, glow, hat, glasses, back, buddy, legs`

Colors must be `#RRGGBB`. Reject unknown keys. Bots ignore human-only fields (hair, face, top style, glasses, beanie, cap). Store the config as JSON on the agent.

### 3D engine requirements

- The engine lives in `packages/characters` and exposes `createStage(canvas, options)`, `stage.addActor(config, options)`, `actor.setConfig()`, `actor.play(motion)`, `actor.setExpression()`, `stage.power(name)`, `stage.dispose()`. React only wraps it.
- Load it client-side only with `next/dynamic` and `ssr: false`. Initialise the hero stage after first paint so text renders first.
- Keep everything the prototype does: blinking, eye and head tracking of the cursor, spring physics on hair, antenna, cape and buddy, the 6 expressions, 10 motions, 6 powers on keys 1 to 6, tap to react, drag to rotate, zoom, save image.
- Dispose geometries, materials and dynamic canvas textures when an actor or stage is removed. Do not dispose the shared cached textures (eyes, glow, blush, shadow, emblem).
- Pause rendering for stages that are off screen (the prototype uses IntersectionObserver).
- Low-power mode: on mobile or when `navigator.hardwareConcurrency <= 4`, cap pixel ratio at 1.5, turn off shadow maps, swap `MeshPhysicalMaterial` for `MeshStandardMaterial`, and show only the middle character in the hero.
- Pre-render the 12 base character portraits and full-body images at build time (a Playwright script that loads the engine and saves WebP files to `apps/web/public/characters/`). The prototype renders these in the browser on load, which is slow. In production only custom agents need a client-side render, done once on publish and uploaded to the API.
- Targets: no console errors, hero text visible before the 3D loads, 3D steady at 50 fps or more on a mid-range laptop, and the page usable on a mid-range Android phone.

## 5. Features and acceptance criteria

### 5.1 Sign in

- SIWE on Robinhood Chain. `GET /auth/nonce` stores a nonce in Redis for 5 minutes. `POST /auth/verify` checks the message, domain, chain id and nonce, then sets an httpOnly, Secure, SameSite=Lax session cookie.
- The wallet address (lowercased) is the user identity. Create the user on first sign in.
- Get the chain id and RPC URL from the official Robinhood Chain docs (https://docs.robinhood.com/chain) and put them in env. Do not hardcode values from memory.

### 5.2 Agents

- Create, read, update and delete own agents. The studio autosaves with a 700 ms debounce (the prototype shows "Saving…" then "Saved").
- Validation: name 1 to 32 chars, instructions up to 2,000 chars, 0 to 4 skills from the fixed list, price an integer from 0 to 500, valid `CharacterConfig`.
- Instructions are private. Never return them to anyone except the owner, in any endpoint, share page, embed, OG tag or log.
- Each agent gets a short unique slug for public URLs.

### 5.3 Runs

`POST /runs` with `{ agentId, skillId, task }`. Stream the answer back over Server-Sent Events so the typing effect in the UI is real.

Inside one database transaction at the start:

1. Check the skill is equipped on the agent and the task is 1 to 4,000 chars.
2. Work out the cost. Studio runs of your own agent cost `RUN_COST_CR` (5 in preview). Running a published agent costs its price. Testing your own published agent from Discover is free, as in the prototype.
3. Check the runner's balance, debit it with a ledger entry, create the Run with status RUNNING.

Then call the AI. On success, credit the creator `price - fee` (fee depends on the creator's tier, section 5.8), record the fee, set status DONE. On failure, refund the runner in full, set status REFUNDED and pay the creator nothing.

Prompt: build the system prompt the same way as `liveRun()` in the prototype (agent name, instructions, tone, language, the skill's prompt, length limit). Put the creator's instructions in the system prompt and the runner's task in the user turn. Rate limit runs per wallet (`RATE_LIMIT_RUNS_PER_MIN`). Store model name and token counts on the Run.

Web research: if `ENABLE_WEB_SEARCH=true`, give that skill the Anthropic server-side web search tool. If not, the skill answers from model knowledge and the UI must say it does not browse.

Pricing check: before launch, confirm that the cheapest run price covers the model cost per run. Check current model names and pricing at https://docs.claude.com/en/docs/about-claude/models and set `AI_MODEL` accordingly.

### 5.4 Credits and ledger

- Store credits as integers in centi-credits (1 CR = 100 units) using BigInt. Never use floats for money.
- The ledger is append-only. Every balance change writes a `LedgerEntry` with a unique idempotency key and the balance after the change, in the same transaction that updates the cached `User.balance`.
- A nightly job recomputes balances from the ledger and alerts on any mismatch.
- Preview mode (phases 2 and 3): an admin endpoint grants preview credits. The prototype's "+100 / +500 / +1,000" buttons call it only when `PREVIEW_CREDITS=true`.

### 5.5 Top-ups with USDG

- The user approves USDG and calls `CreditVault.deposit(amount)`. The contract emits `Deposited(user, amount)`.
- A worker indexes `Deposited` events, waits `DEPOSIT_CONFIRMATIONS` blocks, then credits `amount * CREDITS_PER_USDG` with idempotency key `txHash:logIndex`.
- Get the USDG token address and decimals from official sources and put them in env.

### 5.6 Claims

- A creator asks to claim N credits. The API debits the ledger (CLAIM_REQUEST), then returns an EIP-712 voucher `{user, amount, nonce, expiry}` signed by `CLAIM_SIGNER_PRIVATE_KEY`.
- The user submits the voucher to `CreditVault.claim()`. The vault checks the signature, the nonce, the expiry and a daily payout cap, then transfers USDG.
- The indexer marks the claim PAID on the `Claimed` event. If a voucher expires unused, a job reverses the ledger debit (CLAIM_REVERT).
- The signer key can only authorise claims within the vault's caps. The vault owner is a multisig, not a server key.

### 5.7 Publishing, Discover, share and embed

- Publish sets `published=true` and a price. On publish, the client renders the agent's portrait once and uploads it (`POST /agents/:id/thumbnail`, PNG or WebP, max 1 MB). Serve uploads from Nginx.
- Discover: paginated list of published agents with category filters (category comes from the agent's skills), sort by runs or rating, and a run modal like the prototype.
- Ratings: after a DONE run the runner can rate it 1 to 5 stars, once per run.
- Share page `/a/[slug]`: server-rendered, shows the character, name, creator, skills and price, with OG and Twitter image tags using the thumbnail.
- Embed page `/embed/[slug]`: only the 3D stage, like the prototype's `?view=embed` mode. Allow framing only on embed routes (`frame-ancestors *` on `/embed/*`, `frame-ancestors 'self'` elsewhere).
- Important: the prototype puts the whole agent, including instructions, in the share link hash. Do not do that in production. Public links carry only the slug.

### 5.8 Holder tiers

Read the connected wallet's ORBIS balance with viem (cache 60 seconds in Redis). If `TOKEN_ADDRESS` is empty, everyone is Free and the UI shows "Coming soon" for the token address.

| Tier | Hold | Creator fee |
| --- | --- | --- |
| Free | 0 | 5% |
| Holder | 1,000,000 | 4% |
| Builder | 5,000,000 | 2.5% |
| Whale | 20,000,000 | 0% |

Keep these numbers in config, not scattered in code.

### 5.9 Holder rewards (last phase, behind `REWARDS_ENABLED`)

The prototype advertises an hourly reward in tokenized stock (NVDA, TSLA, AAPL), sample rate $0.004 per hour per 1,000,000 ORBIS. Build this only after the owner confirms the reward asset, the rate and the legal setup. Stock tokens are not available to US persons or in restricted countries, so claimants must confirm eligibility before claiming. Suggested design: hourly snapshots, epoch Merkle roots, a `RewardsDistributor` contract with Merkle claims. Get tokenized stock contract addresses from official sources only.

### 5.10 Landing page data

Replace every hardcoded number with API data: agents built, runs, total paid to creators, the Discover grid, the weekly creator leaderboard (cache 5 minutes), and the hero floating cards (recent real runs and earnings). Remove the "Preview figures" and "Preview data" labels once the data is real.

## 6. Data model

A draft Prisma schema is in `prisma/schema.prisma`. It covers User, Agent, Run, LedgerEntry, Deposit, Claim and Rating. Adjust it if needed, but keep: BigInt centi-credits, the append-only ledger with idempotency keys, and private instructions.

## 7. API (Fastify, all JSON, all inputs validated with zod)

| Method | Path | Notes |
| --- | --- | --- |
| GET | /auth/nonce | SIWE nonce |
| POST | /auth/verify | SIWE verify, sets session |
| POST | /auth/logout | |
| GET | /me | wallet, balance, tier |
| GET | /me/ledger | paginated |
| GET | /agents/mine | owner only, includes instructions |
| POST | /agents | create draft |
| PATCH | /agents/:id | owner only, autosave |
| DELETE | /agents/:id | owner only |
| POST | /agents/:id/publish | price, publish or unpublish |
| POST | /agents/:id/thumbnail | image upload |
| GET | /discover | published agents, filters, sort, cursor |
| GET | /a/:slug | public agent, no instructions |
| POST | /runs | starts run, SSE stream |
| POST | /runs/:id/rating | 1 to 5 |
| GET | /leaderboard | weekly |
| GET | /stats | landing metrics |
| POST | /claims | returns signed voucher |
| GET | /claims | own claims |
| POST | /admin/credits | preview grants, admin wallets only |

## 8. Smart contracts

- `CreditVault`: holds USDG. `deposit(amount)` pulls USDG with `transferFrom` and emits `Deposited`. `claim(amount, nonce, expiry, signature)` verifies an EIP-712 voucher from the claim signer, marks the nonce used, enforces a daily cap, transfers USDG and emits `Claimed`. Pausable. Owner is a multisig. Signer address can be rotated by the owner.
- Write full Foundry tests: replayed nonce, expired voucher, wrong signer, cap exceeded, paused, reentrancy.
- Deploy to testnet first. Mainnet only after an external audit and the owner's explicit go-ahead.

## 9. Environment

See `.env.example`. Every chain address and chain id must come from official documentation or the owner. Leave them empty rather than guessing.

## 10. Security checklist

- Session cookie httpOnly, Secure, SameSite=Lax. CSRF protection on state-changing routes.
- Rate limits on auth, runs, uploads and claims (Redis).
- Strict CSP. Framing allowed only on `/embed/*`.
- Instructions never leave the server except to their owner and the AI provider.
- Money moves only inside DB transactions with idempotency keys.
- Image uploads: check type and size, strip metadata, store under a random name.
- Log errors without task text, instructions or keys.
- Daily `pg_dump` backups kept for 14 days.

## 11. Deployment (Hostinger VPS)

- PM2 ecosystem file with three processes: `web` (Next.js on port 3000), `api` (Fastify on port 4000), `worker` (BullMQ jobs and chain indexer).
- Nginx: `/` to web, `/api` to api, `/uploads` served from disk, gzip and brotli, long cache headers for `/_next/static` and `/characters`.
- Let's Encrypt with certbot, auto-renew.
- PostgreSQL and Redis on the VPS or managed, with passwords and no public ports.
- A `deploy/README.md` with exact setup and update commands Michael can copy and paste.

## 12. Phases

1. **Port the frontend.** Next.js app with every section of the prototype, the 3D engine package, pre-rendered character images, static placeholder data. Done when it matches the prototype on desktop and mobile and has no console errors.
2. **Accounts and agents.** SIWE, agent CRUD with autosave, publish and unpublish, thumbnails, Discover from the DB, share and embed pages. Preview credits from the admin endpoint.
3. **Runs and the ledger.** Streaming AI runs, debits, creator credits, fees by tier, refunds, ratings, leaderboard, real landing stats.
4. **USDG on testnet, then mainnet.** CreditVault, deposit indexer, claims with vouchers. Mainnet only after audit and owner approval.
5. **Holder rewards.** Only when the owner confirms the details in 5.9.

## 13. Prototype shortcuts that must be replaced

- Mock wallet connect: random address.
- Credits, ledger and runs live in browser memory.
- Publishing simulates incoming runs with `setInterval`.
- The share link hash contains the full agent including instructions.
- The AI is called from the browser, and falls back to canned sample answers.
- Discover agents, leaderboard, metrics and hero cards are hardcoded.
- All character thumbnails are rendered in the browser at load.

## 14. Open questions for the owner (use the defaults until answered)

- Final product name and domain. Default: keep "Orbis" in one constant.
- Credits per USDG. Default: 100 CR = 1 USDG.
- Platform fee. Default: 5%, with tier discounts above.
- Price of a studio run. Default: 5 CR.
- ORBIS token address. Default: empty, tiers stay Free.
- Reward asset, rate and legal setup. Default: rewards off.
