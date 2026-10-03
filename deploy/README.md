# Deploy (Hostinger VPS, Ubuntu)

Phase 1 runs only the Next.js web app: PM2 process `web` on 127.0.0.1:3000 behind Nginx with Let's Encrypt. The API, worker, PostgreSQL and Redis are added in phase 2.

Prerequisites: DNS `A @ -> <VPS IP>` and `CNAME www -> <domain>` (already set for mochibo.studio).

## First-time setup

All commands run as root on the VPS.

1. Create the app user and a read-only deploy key for GitHub:

   ```bash
   adduser --disabled-password --gecos "" mochibo
   sudo -u mochibo ssh-keygen -t ed25519 -N "" -f /home/mochibo/.ssh/id_ed25519 -C "mochibo-vps"
   cat /home/mochibo/.ssh/id_ed25519.pub
   ```

2. In GitHub, open the repo > Settings > Deploy keys > Add deploy key. Paste the printed key and leave "Allow write access" off.

3. Clone the repo and run the setup script:

   ```bash
   sudo -u mochibo -H bash -c 'ssh-keyscan github.com >> ~/.ssh/known_hosts && git clone -b <branch> git@github.com:fourtisf/ORBIS.git ~/app'
   EMAIL=you@example.com bash /home/mochibo/app/deploy/setup.sh
   ```

   The script installs:
   - Node 22, pnpm 10 and PM2
   - Nginx and certbot

   Then it:
   - builds the app and starts it under PM2 (it comes back after a reboot)
   - configures Nginx for `mochibo.studio` and `www`
   - enables ufw for SSH, HTTP and HTTPS
   - gets a certificate with an HTTP to HTTPS redirect

   Override the defaults with `DOMAIN=...`, `APP_USER=...` or `NODE_MAJOR=...`.

## Update to the latest code

```bash
bash /home/mochibo/app/deploy/update.sh
```

## Useful commands

```bash
sudo -u mochibo pm2 status          # process list
sudo -u mochibo pm2 logs web        # app logs
nginx -t && systemctl reload nginx  # after editing the Nginx site
certbot renew --dry-run             # check auto-renewal (a systemd timer runs it)
```

## Notes

- **Node 22.** Node 20 reached end of life in April 2026, so the script installs Node 22 LTS. Next 14 supports it, and CI and dev already run on 22. Set `NODE_MAJOR=20` to pin the old version.
- **Build-time URL.** `NEXT_PUBLIC_APP_URL` is written to `apps/web/.env.production.local` and baked in at build time. It is used for share and embed links.
- **Network during the build.** The build downloads Bricolage Grotesque from Google Fonts (`next/font`), so the VPS needs outbound HTTPS while building.
- **Not yet set up.** Brotli (it needs an Nginx module) and the daily `pg_dump` backups (there is no database until phase 2).
