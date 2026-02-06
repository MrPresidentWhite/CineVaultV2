#!/usr/bin/env bash
# deploy.sh — Deploy CineVault V2 (Next.js) ohne Docker, per SSH aus GitHub Actions.
# - Git pull, npm ci (mit devDeps für Build), Prisma generate/migrate, next build
# - Ein PM2-Block: restart (zuverlässiger als reload) oder start beim ersten Mal
# - nvm-Unterstützung für non-interactive Shells

set -Eeuo pipefail

# --------------------------- Config ---------------------------
APP_DIR="${APP_DIR:-/opt/CineVaultV2}"
PM2_APP_NAME="${PM2_APP_NAME:-cinevaultv2}"
NODE_ENV="${NODE_ENV:-production}"
PRISMA_BIN="${PRISMA_BIN:-npx prisma}"
NPM_BIN="${NPM_BIN:-npm}"

DEPLOY_STATE_DIR=".deploy"
LOCK_HASH_FILE="${DEPLOY_STATE_DIR}/package-lock.sha256"
PKG_HASH_FILE="${DEPLOY_STATE_DIR}/package.json.sha256"
PRISMA_SCHEMA_HASH_FILE="${DEPLOY_STATE_DIR}/prisma-schema.sha256"
# --------------------------------------------------------------

# ----------------- nvm (falls Node/PM2 über nvm) -----------------
if [ -z "${NVM_DIR:-}" ]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
fi
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "${NVM_DIR}/nvm.sh"
fi
# --------------------------------------------------------------

echo "[deploy] APP_DIR: ${APP_DIR}"
cd "${APP_DIR}"
mkdir -p "${DEPLOY_STATE_DIR}"

# ----------------- Helpers -------------------------------------
hash_file() {
  local f="$1"
  if [ -f "$f" ]; then sha256sum "$f" | awk '{print $1}'; else echo "absent"; fi
}
changed() {
  local file="$1" store="$2"
  local cur prev
  cur="$(hash_file "$file")"
  if [ -f "$store" ]; then prev="$(cat "$store")"; else prev="none"; fi
  [[ "$cur" != "$prev" ]]
}
save_hash() {
  local file="$1" store="$2"
  hash_file "$file" > "$store"
}
ensure_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "[deploy] ERROR: $1 not found"; exit 127; }
}
# --------------------------------------------------------------

ensure_cmd git
ensure_cmd "$NPM_BIN"
ensure_cmd node
ensure_cmd pm2

# ----------------- Git -----------------------------------------
echo "[deploy] git fetch..."
git fetch --all --prune
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [ "$branch" = "HEAD" ] || [ -z "$branch" ]; then
  branch="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | cut -d/ -f2- || echo main)"
fi
echo "[deploy] reset to origin/${branch}"
git reset --hard "origin/${branch}"
# --------------------------------------------------------------

# ----------------- Change detection -----------------------------
PKG_CHANGED=false
LOCK_CHANGED=false
PRISMA_SCHEMA_CHANGED=false
if changed "package.json" "${PKG_HASH_FILE}"; then PKG_CHANGED=true; fi
if changed "package-lock.json" "${LOCK_HASH_FILE}"; then LOCK_CHANGED=true; fi
if changed "prisma/schema.prisma" "${PRISMA_SCHEMA_HASH_FILE}"; then PRISMA_SCHEMA_CHANGED=true; fi
NEED_INSTALL=false
if $PKG_CHANGED || $LOCK_CHANGED || [ ! -d node_modules ]; then
  NEED_INSTALL=true
fi
# --------------------------------------------------------------

# ----------------- Install (mit dev für next build) -------------
echo "[deploy] npm ci --include=dev..."
"$NPM_BIN" ci --include=dev
# --------------------------------------------------------------

# ----------------- Prisma ---------------------------------------
if $PRISMA_SCHEMA_CHANGED || [ ! -d src/generated/prisma ]; then
  echo "[deploy] prisma generate..."
  ${PRISMA_BIN} generate
else
  echo "[deploy] prisma generate (skip, kein Schema-Change)"
fi
echo "[deploy] prisma migrate deploy..."
${PRISMA_BIN} migrate deploy
# --------------------------------------------------------------

# ----------------- Next.js Build ---------------------------------
echo "[deploy] clean .next (vermeidet Server-Action-Mismatch nach Deploy)"
rm -rf .next
echo "[deploy] next build..."
"$NPM_BIN" run -s build
# --------------------------------------------------------------

# ----------------- PM2: ein Block, restart (kein prune) ---------
EXISTING=$(pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d||'[]');console.log(a.filter(x=>x.name==='${PM2_APP_NAME}').length)}catch(e){console.log(0)}})")
if [ "${EXISTING:-0}" -gt 1 ]; then
  echo "[deploy] mehrere PM2-Instanzen -> alle löschen, neu starten"
  pm2 delete "${PM2_APP_NAME}" 2>/dev/null || true
  EXISTING=0
fi

if [ "${EXISTING:-0}" -eq 1 ]; then
  echo "[deploy] pm2 restart ${PM2_APP_NAME}"
  NODE_ENV="${NODE_ENV}" pm2 restart "${PM2_APP_NAME}" --update-env
else
  echo "[deploy] pm2 start (erster Start) ${PM2_APP_NAME}"
  NODE_ENV="${NODE_ENV}" pm2 start ecosystem.config.cjs --only "${PM2_APP_NAME}"
fi
pm2 save
# --------------------------------------------------------------

# ----------------- Hashes für nächsten Lauf ----------------------
save_hash "package.json" "${PKG_HASH_FILE}"
save_hash "package-lock.json" "${LOCK_HASH_FILE}"
save_hash "prisma/schema.prisma" "${PRISMA_SCHEMA_HASH_FILE}"
# --------------------------------------------------------------

echo "[deploy] done."
