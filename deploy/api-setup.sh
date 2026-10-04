#!/usr/bin/env bash
# Sets up what the API needs, without touching other apps on the server. Run as root.
# setup.sh and update.sh call it; it is safe to run again.
#
#   1. A private Redis instance for Mochibo (redis-server@mochibo), localhost only, with a password.
#      An existing Redis used by other apps is left alone.
#   1b. PostgreSQL with a "mochibo" role and database (other databases on the server are untouched).
#   2. A free local port for the API, stored in deploy/.api-port.
#   3. /home/mochibo/api.env, the API's secret settings (readable by the app user only).
#      Values you set yourself (OpenRouter key, model, limits) are kept.
#   4. The uploads folder for agent portraits, daily backups (14 days) and a 5-minute health check.
#   5. The Nginx routes /api -> API and /uploads -> portraits on disk, as a snippet included by the site.
set -euo pipefail

DOMAIN="${DOMAIN:-mochibo.studio}"
APP_USER="${APP_USER:-mochibo}"
APP_DIR="/home/$APP_USER/app"
ENV_FILE="/home/$APP_USER/api.env"
REDIS_CONF="/etc/redis/redis-mochibo.conf"
SNIPPET="/etc/nginx/snippets/mochibo-api.conf"
SITE="/etc/nginx/sites-available/$DOMAIN"
UPLOAD_DIR="/var/www/mochibo-uploads"

[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
port_free() { ! ss -ltnH "sport = :$1" | grep -q .; }

echo "==> Redis (private instance for Mochibo)"
if ! command -v redis-server >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get -o DPkg::Lock::Timeout=600 install -y redis-server
fi
if [ ! -f "$REDIS_CONF" ]; then
  REDIS_PORT=""
  for p in 6380 6381 6382 6383 6384 6385; do if port_free "$p"; then REDIS_PORT=$p; break; fi; done
  [ -n "$REDIS_PORT" ] || { echo "No free port for Redis in 6380-6385."; exit 1; }
  REDIS_PASS="$(openssl rand -hex 24)"
  cp /etc/redis/redis.conf "$REDIS_CONF"
  sed -i \
    -e "s@^bind .*@bind 127.0.0.1 -::1@" \
    -e "s@^port .*@port $REDIS_PORT@" \
    -e "s@^dbfilename .*@dbfilename dump-mochibo.rdb@" \
    -e "s@^logfile .*@logfile /var/log/redis/redis-server-mochibo.log@" \
    -e "s@^pidfile .*@pidfile /run/redis-mochibo/redis-server.pid@" \
    -e "s@^# *requirepass .*@requirepass $REDIS_PASS@" \
    "$REDIS_CONF"
  grep -q "^requirepass " "$REDIS_CONF" || echo "requirepass $REDIS_PASS" >> "$REDIS_CONF"
  chown redis:redis "$REDIS_CONF"
  chmod 640 "$REDIS_CONF"
  systemctl enable --now redis-server@mochibo >/dev/null
fi
systemctl is-active --quiet redis-server@mochibo || systemctl restart redis-server@mochibo
REDIS_PORT="$(awk '/^port /{print $2}' "$REDIS_CONF")"
REDIS_PASS="$(awk '/^requirepass /{print $2}' "$REDIS_CONF")"
for _ in 1 2 3 4 5; do
  redis-cli -p "$REDIS_PORT" -a "$REDIS_PASS" --no-auth-warning ping 2>/dev/null | grep -q PONG && break
  sleep 1
done
redis-cli -p "$REDIS_PORT" -a "$REDIS_PASS" --no-auth-warning ping | grep -q PONG || { echo "Redis is not answering on port $REDIS_PORT. Check: journalctl -u redis-server@mochibo"; exit 1; }
echo "    redis-server@mochibo on 127.0.0.1:$REDIS_PORT"

echo "==> PostgreSQL (database for users and credits)"
if ! ls /usr/lib/postgresql/*/bin/postgres >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get -o DPkg::Lock::Timeout=600 install -y postgresql
fi
systemctl enable --now postgresql >/dev/null 2>&1 || systemctl start postgresql
for _ in 1 2 3 4 5 6 7 8 9 10; do sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done
PG_PORT="$(sudo -u postgres psql -tAc "SHOW port" | tr -d '[:space:]')"
DB_PASS_FILE="/home/$APP_USER/.mochibo-db-password"
if [ ! -s "$DB_PASS_FILE" ]; then
  openssl rand -hex 24 > "$DB_PASS_FILE"
fi
chown "$APP_USER:$APP_USER" "$DB_PASS_FILE"; chmod 600 "$DB_PASS_FILE"
DB_PASS="$(cat "$DB_PASS_FILE")"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='mochibo'" | grep -q 1; then
  sudo -u postgres psql -q -c "ALTER ROLE mochibo WITH LOGIN PASSWORD '$DB_PASS'"
else
  sudo -u postgres psql -q -c "CREATE ROLE mochibo WITH LOGIN PASSWORD '$DB_PASS'"
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='mochibo'" | grep -q 1 || sudo -u postgres psql -q -c "CREATE DATABASE mochibo OWNER mochibo"
DATABASE_URL="postgresql://mochibo:$DB_PASS@127.0.0.1:$PG_PORT/mochibo"
echo "    database mochibo on 127.0.0.1:$PG_PORT"

echo "==> API port"
PORT_FILE="$APP_DIR/deploy/.api-port"
API_PORT="$(cat "$PORT_FILE" 2>/dev/null || true)"
if [ -z "$API_PORT" ]; then
  for p in 4000 4100 4200 4300 4400 4500; do if port_free "$p"; then API_PORT=$p; break; fi; done
  [ -n "$API_PORT" ] || { echo "No free port for the API in 4000-4500."; exit 1; }
  echo "$API_PORT" > "$PORT_FILE"; chown "$APP_USER:$APP_USER" "$PORT_FILE"
fi
echo "    Using 127.0.0.1:$API_PORT"

echo "==> API settings ($ENV_FILE)"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<ENV
# Mochibo API settings. Secret: never share this file or commit it.
# After editing, restart the API:  sudo -u $APP_USER env PATH=/opt/mochibo-node/bin:\$PATH pm2 restart api

# OpenRouter key (openrouter.ai > Keys). Set a monthly credit limit on the key in OpenRouter.
OPENROUTER_API_KEY=
# Model id copied from openrouter.ai/models, for example anthropic/claude-haiku-4.5
AI_MODEL=
# Longest answer, in tokens
AI_MAX_TOKENS=1200
# true gives the Web research skill OpenRouter web search (paid per request)
ENABLE_WEB_SEARCH=false

# Preview limits
RATE_LIMIT_RUNS_PER_MIN=6
RUNS_PER_WALLET_PER_DAY=20
RUNS_PER_DAY_TOTAL=500

# Agent battles: price to start one, prize for the winner's creator (whole CR), battles per wallet per day
BATTLE_COST_CR=15
BATTLE_PRIZE_CR=5
BATTLES_PER_WALLET_PER_DAY=5

# Robinhood Chain id (from the official docs). Empty accepts sign-in from any chain.
CHAIN_ID=
# Optional RPC, only needed to sign in with smart-contract wallets
RPC_URL=

# One-time free credits for a new wallet, and the price of a studio run (whole CR)
WELCOME_CREDITS=100
RUN_COST_CR=5

# Managed by deploy/api-setup.sh
NODE_ENV=production
APP_URL=https://$DOMAIN
REDIS_URL=redis://:$REDIS_PASS@127.0.0.1:$REDIS_PORT
DATABASE_URL=$DATABASE_URL
UPLOAD_DIR=$UPLOAD_DIR
ENV
else
  # Keep the owner's values; refresh only the lines this script manages.
  # Values can contain any character (the Redis URL has "@" and ":"), so lines are replaced without sed.
  set_key() {
    local tmp
    tmp="$(mktemp)"
    awk -v k="$1" -v v="$2" 'BEGIN { done = 0 } index($0, k "=") == 1 { if (!done) print k "=" v; done = 1; next } { print } END { if (!done) print k "=" v }' "$ENV_FILE" > "$tmp"
    cat "$tmp" > "$ENV_FILE"
    rm -f "$tmp"
  }
  set_key NODE_ENV production
  set_key APP_URL "https://$DOMAIN"
  set_key REDIS_URL "redis://:$REDIS_PASS@127.0.0.1:$REDIS_PORT"
  set_key DATABASE_URL "$DATABASE_URL"
  set_key UPLOAD_DIR "$UPLOAD_DIR"
  # Answers got longer: move the old default up, but keep a value the owner chose.
  if grep -qx "AI_MAX_TOKENS=700" "$ENV_FILE"; then set_key AI_MAX_TOKENS 1200; fi
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"
if grep -qE "^OPENROUTER_API_KEY=.+" "$ENV_FILE" && grep -qE "^AI_MODEL=.+" "$ENV_FILE"; then
  echo "    OpenRouter key and model are set"
else
  echo "    OpenRouter key or model is still empty: runs say live answers are not switched on yet."
  echo "    Add them to $ENV_FILE (see deploy/README.md)."
fi

echo "==> Nightly ledger check (cron, 03:17 server time)"
cat > /etc/cron.d/mochibo-reconcile <<CRON
# Mochibo: cached balances must match the credits ledger (written by deploy/api-setup.sh).
# Results go to /home/$APP_USER/reconcile.log; a mismatch is logged as MISMATCH.
17 3 * * * $APP_USER cd $APP_DIR && /opt/mochibo-node/bin/node --env-file=$ENV_FILE apps/api/dist/reconcile.cjs >> /home/$APP_USER/reconcile.log 2>&1
CRON
chmod 644 /etc/cron.d/mochibo-reconcile

echo "==> Agent portraits ($UPLOAD_DIR)"
mkdir -p "$UPLOAD_DIR"
chown "$APP_USER:$APP_USER" "$UPLOAD_DIR"
chmod 755 "$UPLOAD_DIR"

echo "==> Daily backups (cron, 03:41 server time, kept 14 days in /var/backups/mochibo)"
cat > /etc/cron.d/mochibo-backup <<CRON
# Mochibo: database and portraits backup (written by deploy/api-setup.sh). Log: /var/log/mochibo-backup.log
41 3 * * * root UPLOAD_DIR=$UPLOAD_DIR bash $APP_DIR/deploy/backup.sh >> /var/log/mochibo-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/mochibo-backup

echo "==> Health check (cron, every 5 minutes, problems in /home/$APP_USER/health.log)"
cat > /etc/cron.d/mochibo-health <<CRON
# Mochibo: restarts the API if it stops answering (written by deploy/api-setup.sh).
*/5 * * * * root APP_USER=$APP_USER bash $APP_DIR/deploy/health-check.sh
CRON
chmod 644 /etc/cron.d/mochibo-health

echo "==> Nginx routes /api and /uploads"
mkdir -p /etc/nginx/snippets
cat > "$SNIPPET" <<NGINX
# Mochibo API (written by deploy/api-setup.sh). Streams answers, so buffering is off.
location /api/ {
    proxy_pass http://127.0.0.1:$API_PORT/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    # Overwrite, never append: the API trusts this header for per-IP limits.
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 120s;
    gzip off;
}

# Agent portraits, straight from disk. Names are random and change on every upload, so they cache forever.
location /uploads/ {
    alias $UPLOAD_DIR/;
    autoindex off;
    types { image/webp webp; image/png png; }
    default_type application/octet-stream;
    add_header X-Content-Type-Options nosniff always;
    add_header Cache-Control "public, max-age=31536000, immutable";
    access_log off;
}
NGINX
if [ -f "$SITE" ] && ! grep -q "mochibo-api.conf" "$SITE"; then
  # Older installs (and the HTTPS block certbot wrote): add the include after each server_name line.
  sed -i "/server_name .*$DOMAIN/a\\    include $SNIPPET;" "$SITE"
fi
if [ -f "$SITE" ]; then
  nginx -t
  systemctl reload nginx
fi
