# Deploy (Hostinger VPS, Ubuntu)

Two PM2 processes run behind Nginx with Let's Encrypt:
- `web`: the Next.js app, on 127.0.0.1 port 3000 or the next free one.
- `api`: the Fastify API (wallet sign-in and live AI runs), on 127.0.0.1 port 4000 or the next free one. Nginx sends `/api/` to it.

The API keeps sessions and run limits in a private Redis instance (`redis-server@mochibo`, localhost only, with a password). The worker and PostgreSQL come with phase 3.

Prerequisites: DNS `A @ -> <VPS IP>` and `CNAME www -> <domain>` (already set for mochibo.studio).

## First-time setup

All commands run as root on the VPS.

1. Create the app user and clone the repo. The repo is public, so HTTPS needs no key:

   ```bash
   apt-get update && apt-get install -y git
   adduser --disabled-password --gecos "" mochibo
   sudo -u mochibo git clone https://github.com/fourtisf/mochibo.git /home/mochibo/app
   ```

   If the repo becomes private later, use a deploy key instead:
   - Run `sudo -u mochibo ssh-keygen -t ed25519 -N ""` on the VPS.
   - In GitHub, add the public key under Settings > Deploy keys, read-only.
   - Clone with `git@github.com:fourtisf/mochibo.git`.

2. Run the setup script. It first runs `deploy/preflight.sh`, which checks DNS, network access, the domain, Nginx, memory and disk in one pass, fixes DNS and swap if needed, and stops before changing anything if something is still blocking:

   ```bash
   EMAIL=you@example.com bash /home/mochibo/app/deploy/setup.sh
   ```

   The script installs:
   - a private copy of Node 22 in `/opt/mochibo-node` (other apps on the server keep their own Node), plus pnpm 10 and PM2
   - Nginx and certbot

   Then it:
   - builds the app and starts it under PM2 (it comes back after a reboot)
   - configures Nginx for `mochibo.studio` and `www`
   - picks a free local port (3000, or 3100 and up if taken) and stores it in `deploy/.web-port`
   - allows SSH, HTTP and HTTPS in ufw only if ufw is already active (other services may share the server)
   - gets a certificate with an HTTP to HTTPS redirect

   Override the defaults with `DOMAIN=...`, `APP_USER=...` or `NODE_MAJOR=...`.

## Public settings (wallets, token, chain)

Put browser-safe settings in `/home/mochibo/mochibo.env`. Both scripts copy this file into the build. Never put secrets here: everything in it is visible in the browser.

```bash
cat > /home/mochibo/mochibo.env <<'ENV'
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # free at cloud.reown.com; needed for mobile wallets and QR codes
NEXT_PUBLIC_TOKEN_ADDRESS=              # leave empty until the token is live ("CA: Coming soon")
NEXT_PUBLIC_CHAIN_ID=                   # Robinhood Chain id, from the official docs
NEXT_PUBLIC_RPC_URL=                    # from the official docs
NEXT_PUBLIC_EXPLORER_URL=               # optional
ENV
chown mochibo:mochibo /home/mochibo/mochibo.env
bash /home/mochibo/app/deploy/update.sh
```

## Live AI answers (OpenRouter)

The API calls OpenRouter. The key lives only in `/home/mochibo/api.env` on the server (readable by the app user only), never in the browser or in git.

1. At [openrouter.ai](https://openrouter.ai), add credits, then go to Keys and create a key. **Set a credit limit on the key** (for example 20 USD a month). This is the hard cap on what the AI can cost.
2. Pick a model at [openrouter.ai/models](https://openrouter.ai/models) and copy its id (for example `anthropic/claude-haiku-4.5`). A small, fast model keeps each run cheap. Check its price per million tokens against the run price.
3. Put both in the settings file and restart the API:

   ```bash
   nano /home/mochibo/api.env        # fill OPENROUTER_API_KEY= and AI_MODEL=, save with Ctrl+O, Enter, Ctrl+X
   sudo -u mochibo env PATH=/opt/mochibo-node/bin:$PATH pm2 restart api
   ```

Until both are set, runs answer "Live answers are not switched on yet."

The same file holds the preview limits:
- `RUNS_PER_WALLET_PER_DAY` (default 20)
- `RUNS_PER_DAY_TOTAL` (default 500): when reached, runs pause until midnight UTC
- `RATE_LIMIT_RUNS_PER_MIN` (default 6)
- `AI_MAX_TOKENS` (default 700)

Change a value, then restart the API with the command above.

Who can run: only wallets that are connected **and** signed in (one free signature, no gas). The session cookie is httpOnly and lasts 7 days.

## Update to the latest code

```bash
bash /home/mochibo/app/deploy/update.sh
```

The script pulls first and then runs its own newest version. On a server set up before the API existed, it also installs Redis, creates `/home/mochibo/api.env`, picks the API port and adds the `/api` route to Nginx (it keeps the HTTPS settings certbot wrote).

## Useful commands

```bash
export PATH=/opt/mochibo-node/bin:$PATH
sudo -u mochibo env PATH=$PATH pm2 status     # process list
sudo -u mochibo env PATH=$PATH pm2 logs web   # web logs
sudo -u mochibo env PATH=$PATH pm2 logs api   # API logs (runs are logged without task text or instructions)
curl -s http://127.0.0.1:$(cat /home/mochibo/app/deploy/.api-port)/health   # API health
systemctl status redis-server@mochibo         # Mochibo's Redis
nginx -t && systemctl reload nginx  # after editing the Nginx site
certbot renew --dry-run             # check auto-renewal (a systemd timer runs it)
```

## Notes

- **Node 22.** Node 20 reached end of life in April 2026, so the script installs Node 22 LTS. Next 14 supports it, and CI and dev already run on 22. Set `NODE_MAJOR=20` to pin the old version.
- **Build-time URL.** `NEXT_PUBLIC_APP_URL` is written to `apps/web/.env.production.local` and baked in at build time. It is used for share and embed links.
- **Network during the build.** The build downloads Bricolage Grotesque from Google Fonts (`next/font`), so the VPS needs outbound HTTPS while building.
- **Not yet set up.** Brotli (it needs an Nginx module) and the daily `pg_dump` backups (there is no database until phase 3).
- **Redis.** Mochibo runs its own Redis instance from `/etc/redis/redis-mochibo.conf` (port 6380 or the next free one). A Redis that other apps use is not touched.
