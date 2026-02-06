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

log "Running Prisma migrations..."
if ! su-exec nextjs npx prisma migrate deploy 2>> "$LOG"; then
  log "ERROR: Prisma migrate deploy failed. See $LOG"
  exit 1
fi
log "Prisma migrations done."

log "Starting Next.js (node server.js)..."
exec su-exec nextjs node server.js
