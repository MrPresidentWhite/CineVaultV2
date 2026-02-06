#!/usr/bin/env bash
# deploy.sh — Docker-Deploy via SSH (z. B. aus GitHub Actions)
# - Git pull im APP_DIR
# - docker compose up -d --build (App + Postgres + Redis)
# - .env muss im APP_DIR vorhanden sein (siehe .env.docker.example)

set -Eeuo pipefail

# --------------------------- Config ---------------------------
APP_DIR="${APP_DIR:-/opt/CineVaultV2}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cinevaultv2}"
# --------------------------------------------------------------

echo "[deploy] APP_DIR: ${APP_DIR}"
cd "${APP_DIR}"

# ----------------- Pre-flight --------------------------
ensure_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "[deploy] ERROR: '$1' nicht gefunden"; exit 127; }
}
ensure_cmd git
ensure_cmd docker
ensure_cmd docker compose
# --------------------------------------------------------------

# ----------------- Git aktualisieren --------------------------
echo "[deploy] git fetch..."
git fetch --all --prune

branch="$(git rev-parse --abbrev-ref HEAD || true)"
if [ "$branch" = "HEAD" ] || [ -z "$branch" ]; then
  branch="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | cut -d/ -f2- || echo main)"
fi

echo "[deploy] reset to origin/${branch}"
git reset --hard "origin/${branch}"
# --------------------------------------------------------------

# ----------------- .env prüfen --------------------------
if [ ! -f .env ]; then
  echo "[deploy] WARNUNG: .env fehlt – bitte aus .env.docker.example anlegen und Secrets setzen."
  echo "[deploy] Deploy wird trotzdem ausgeführt (Container starten ggf. mit Fehlern)."
fi
# --------------------------------------------------------------

# ----------------- Docker Stack --------------------------
export COMPOSE_PROJECT_NAME
echo "[deploy] docker compose up -d --build..."
docker compose up -d --build

echo "[deploy] ✅ fertig."
