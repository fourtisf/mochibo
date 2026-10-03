# Deploy (Hostinger VPS, Ubuntu)

Phase 1 runs only the Next.js web app: PM2 process `web` on 127.0.0.1 (port 3000 or the next free one) behind Nginx with Let's Encrypt. The API, worker, PostgreSQL and Redis are added in phase 2.

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

## Update to the latest code

```bash
bash /home/mochibo/app/deploy/update.sh
```

## Useful commands

```bash
export PATH=/opt/mochibo-node/bin:$PATH
sudo -u mochibo env PATH=$PATH pm2 status     # process list
sudo -u mochibo env PATH=$PATH pm2 logs web   # app logs
nginx -t && systemctl reload nginx  # after editing the Nginx site
certbot renew --dry-run             # check auto-renewal (a systemd timer runs it)
```

## Notes

- **Node 22.** Node 20 reached end of life in April 2026, so the script installs Node 22 LTS. Next 14 supports it, and CI and dev already run on 22. Set `NODE_MAJOR=20` to pin the old version.
- **Build-time URL.** `NEXT_PUBLIC_APP_URL` is written to `apps/web/.env.production.local` and baked in at build time. It is used for share and embed links.
- **Network during the build.** The build downloads Bricolage Grotesque from Google Fonts (`next/font`), so the VPS needs outbound HTTPS while building.
- **Not yet set up.** Brotli (it needs an Nginx module) and the daily `pg_dump` backups (there is no database until phase 2).
