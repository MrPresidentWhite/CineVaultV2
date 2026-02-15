# Passkey-Deploy-Analyse

**Stand:** Nach Deploy von Commit `b1fc3f4` (15.02.2026)

## Bestätigt aus den Deploy-Logs

- ✅ Passkey-API-Routen sind im Artifact enthalten (extract zeigt alle passkey-Routes)
- ✅ `webauthn.ts` und `webauthn-challenge.ts` sind im Artifact
- ✅ Prisma: "No pending migrations to apply" → WebAuthnCredential-Tabelle existiert
- ✅ PM2-Neustart erfolgreich
- ✅ Deploy endet mit "done"

## Mögliche Ursachen für „Passkey fehlt im Dashboard“

### 1. Redis nicht erreichbar (hohe Wahrscheinlichkeit)

Passkey-Challenges werden in Redis gespeichert. Ohne Redis:

- `setRegistrationChallenge` / `getRegistrationChallenge` → `false` / `null`
- Registrierung schlägt fehl
- Passkey-Login schlägt fehl

Die UI (PasskeysClient) zeigt trotzdem „Passkeys“ und „Passkey hinzufügen“. Wenn Nutzer klicken, erscheinen Fehlermeldungen.

**Check auf dem Server:**

```bash
# Redis-Verbindung testen
redis-cli -h 127.0.0.1 -p 6379 ping
# oder je nach .env:
redis-cli -u "$REDIS_URL" ping
```

### 2. .env beim SKIP_BUILD

Bei `SKIP_BUILD=1` wird `.env` nicht nach `.next/standalone/` kopiert. Der Start-Wrapper lädt aber aus dem Projekt-Root:

```js
require("dotenv").config({ path: path.join(projectRoot, ".env") });
```

`APP_DIR/.env` bleibt die Quelle. Wenn dort `REDIS_URL` fehlt, ist Redis deaktiviert.

**Check:** `REDIS_URL` bzw. `REDIS_HOST` / `REDIS_PORT` in `APP_DIR/.env` prüfen.

### 3. Caching (Browser / CDN)

Alte HTML- oder JS-Version ohne Passkey-Features könnte gecached sein.

**Check:** Hard Refresh (Ctrl+Shift+R), Inkognito-Fenster oder anderer Browser.

### 4. Fehlender Menüpunkt

Der Link steht in `dashboard/layout.tsx` unter „Sicherheit“:

```ts
{ href: "/dashboard/security/2fa", label: "2FA & Passkeys" }
```

Falls die Route `/dashboard/security/2fa` einen Fehler wirft (Server- oder Client-Fehler), könnte die gesamte Layout-Navigation beeinträchtigt sein. Einzelner fehlender Menüpunkt deutet eher auf Caching oder Build-Problem hin.

### 5. .next/static und public

Next.js Standalone benötigt `.next/static` und `public` im Standalone-Verzeichnis. Wenn diese fehlen, funktioniert die gesamte Client-UI schlecht. Da nur Passkey „fehlt“, ist das unwahrscheinlich als Hauptursache.

## Empfohlene Checks (Reihenfolge)

1. **Redis**

   ```bash
   redis-cli ping
   ```

   Außerdem `REDIS_URL` / `REDIS_*` in `APP_DIR/.env` prüfen.

2. **Browser**

   - `/dashboard/security/2fa` direkt aufrufen
   - Konsole (F12) auf Fehler prüfen
   - Hard Refresh (Ctrl+Shift+R)

3. **Server-Logs (PM2)**

   ```bash
   pm2 logs cinevaultv2 --lines 100
   ```

   Nach Fehlern bei Passkey- oder Redis-Aufrufen suchen.

4. **API-Test**

   ```bash
   # Mit Session-Cookie eines eingeloggten Nutzers
   curl -b "cookies.txt" "https://DEINE-DOMAIN/api/dashboard/security/passkeys"
   ```

   Erwartung: JSON mit `ok` und `credentials`.

## Wenn Passkey-Registrierung fehlschlägt

Typische Fehlermeldung bei fehlendem Redis:

- „Optionen konnten nicht geladen werden“
- „Registrierung fehlgeschlagen“

Dann: Redis starten bzw. konfigurieren und App neu starten.
