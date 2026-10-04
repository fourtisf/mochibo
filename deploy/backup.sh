#!/usr/bin/env bash
# Daily backup of the Mochibo database and agent portraits (CLAUDE.md 10). Run as root by
# /etc/cron.d/mochibo-backup, which deploy/api-setup.sh writes. Keeps the last 14 days.
#
# Restore the database (stop the API first, then start it again):
#   gunzip -c /var/backups/mochibo/db-YYYY-MM-DD.sql.gz | sudo -u postgres psql mochibo
# Restore portraits:
#   tar -xzf /var/backups/mochibo/uploads-YYYY-MM-DD.tar.gz -C /var/www
set -euo pipefail

DIR="${BACKUP_DIR:-/var/backups/mochibo}"
UPLOADS="${UPLOAD_DIR:-/var/www/mochibo-uploads}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DAY="$(date +%F)"

umask 077
mkdir -p "$DIR"
chmod 700 "$DIR"

# Write to a temp file first so a failed dump never replaces a good one.
sudo -u postgres pg_dump --no-owner --no-privileges mochibo | gzip -9 > "$DIR/db-$DAY.sql.gz.tmp"
mv "$DIR/db-$DAY.sql.gz.tmp" "$DIR/db-$DAY.sql.gz"
if [ -d "$UPLOADS" ]; then
  tar -czf "$DIR/uploads-$DAY.tar.gz.tmp" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"
  mv "$DIR/uploads-$DAY.tar.gz.tmp" "$DIR/uploads-$DAY.tar.gz"
fi

find "$DIR" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$((KEEP_DAYS - 1))" -delete
echo "$(date -Is) backup ok: $(du -h "$DIR/db-$DAY.sql.gz" | cut -f1) database"
