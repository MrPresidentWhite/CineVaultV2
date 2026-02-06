#!/bin/sh
# Schreibt jeden Schritt in /app/logs/start.log (auf Host: ./app-logs/start.log)
# damit du auch bei sofortigem Absturz etwas siehst.

set -e
LOG=/app/logs/start.log

log() {
  echo "$(date -Iseconds) $*" >> "$LOG" 2>/dev/null || true
  echo "[app] $*"
}

mkdir -p /app/logs
log "=== Container CMD started ==="

if [ -z "$DATABASE_URL" ]; then
  log "WARN: DATABASE_URL is empty in container (check .env and docker-compose environment)"
fi

# Prisma CLI / prisma.config.ts liest .env via dotenv – im Container gibt es keine .env,
# also schreiben wir DATABASE_URL hier rein, damit migrate deploy die URL findet.
printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > /app/.env

log "Running Prisma migrations..."
if ! npx prisma migrate deploy 2>> "$LOG"; then
  log "ERROR: Prisma migrate deploy failed. See $LOG"
  exit 1
fi
log "Prisma migrations done."

log "Starting Next.js (node server.js)..."
exec su-exec nextjs node server.js
