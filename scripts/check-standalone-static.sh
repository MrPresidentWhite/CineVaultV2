#!/usr/bin/env bash
# Diagnose: Prüft ob .next/static im Standalone vorhanden ist (für Client Components wie PasskeyLogin).
# Auf dem Server ausführen: bash scripts/check-standalone-static.sh
# Oder: APP_DIR=/opt/cinevault/app bash scripts/check-standalone-static.sh

set -e

APP_DIR="${APP_DIR:-.}"
STATIC_DIR="${APP_DIR}/.next/standalone/.next/static"
BUILD_ID_FILE="${APP_DIR}/.next/standalone/.next/BUILD_ID"

echo "=== Standalone-Static Diagnose ==="
echo "APP_DIR: $APP_DIR"
echo ""

if [ ! -d "$STATIC_DIR" ]; then
  echo "FEHLER: $STATIC_DIR existiert nicht!"
  echo "→ Client Components (PasskeyLoginButton, PasskeysClient) können nicht rendern."
  echo "→ Staging-Workflow muss .next/static ins Artifact kopieren (Step 'Standalone: .next/static und public ergänzen')."
  exit 1
fi

echo "OK: $STATIC_DIR existiert"
echo ""
echo "Inhalt (erste 15 Dateien):"
find "$STATIC_DIR" -type f | head -15
echo ""
echo "Größe:"
du -sh "$STATIC_DIR"

if [ -f "$BUILD_ID_FILE" ]; then
  echo ""
  echo "BUILD_ID: $(cat "$BUILD_ID_FILE")"
fi

echo ""
echo "=== Test-URL (von extern erreichbar?) ==="
echo "Öffne z.B.: https://DEINE-DOMAIN/_next/static/$(cat "$BUILD_ID_FILE" 2>/dev/null || echo 'BUILD_ID')/_buildManifest.js"
echo "Sollte 200 liefern, kein 404."
