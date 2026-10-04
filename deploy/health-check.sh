#!/usr/bin/env bash
# Checks the API every 5 minutes (/etc/cron.d/mochibo-health, written by deploy/api-setup.sh).
# Problems are logged to /home/mochibo/health.log. If the API does not answer at all (crashed or
# hung), it is restarted. If it answers but the database or Redis is down, it is only logged,
# because restarting the API would not fix that.
set -uo pipefail

APP_USER="${APP_USER:-mochibo}"
APP_DIR="/home/$APP_USER/app"
LOG="/home/$APP_USER/health.log"
PORT="$(cat "$APP_DIR/deploy/.api-port" 2>/dev/null || echo 4000)"

body="$(curl -sS -m 10 -o - -w ' HTTP %{http_code}' "http://127.0.0.1:$PORT/health" 2>&1)"
code=$?
case "$body" in
  *'"ok":true'*' HTTP 200') exit 0 ;;
esac
echo "$(date -Is) health check failed: ${body//$'\n'/ }" >> "$LOG"
if [ "$code" -ne 0 ]; then
  sudo -u "$APP_USER" env PATH="/opt/mochibo-node/bin:$PATH" pm2 restart api >> "$LOG" 2>&1
  echo "$(date -Is) api restarted" >> "$LOG"
fi
