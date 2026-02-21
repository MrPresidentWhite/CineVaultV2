# CineVault V2

**CineVault** ist eine persönliche Film- und Serienverwaltung: Du pflegst deine Sammlung (Filme, Serien, Staffeln, Episoden), nutzt Metadaten von [TMDb](https://www.themoviedb.org/) und behältst den Überblick über Status, Qualität und Speicherplatz.

Diese Version (V2) ist ein Neuaufbau mit **Next.js 16**, **Prisma 7**, **PostgreSQL**, **Redis** und optional **Cloudflare R2** für Bilder.

---

## Features

### Sammlung & Metadaten

- **Filme & Serien** mit TMDb-Import (Poster, Backdrop, Genres, FSK, Laufzeit)
- **Collections** (Franchises, Themen); eine Collection entsteht beim zweiten importierten Film, bestehende Filme werden nachträglich verknüpft
- **Status-Tracking** (Wunschliste, bestellt, verarbeitet, hochgeladen, archiviert)
- **„Auf Wunschliste“ geplant:** geplantes Datum, automatisches Setzen per Cron (z. B. täglich)
- **Akzentfarben** aus Postern für ein einheitliches UI
- **Bulk Refetch** (Admin): Meta und Bilder für viele Einträge neu von TMDb holen

### Speicher & CDN

- **R2/S3-Speicher** für TMDb-Bilder (Pull-Through, keine Duplikate)
- **CDN-Warmup** (node-cron): vorkonfigurierte URLs auf R2/Cloudflare anfragen, um Cache zu füllen

### Benachrichtigungen

- **E-Mail** bei Status-Änderungen (Nodemailer/SMTP)
- **Discord-Webhook** optional bei Status-Änderungen
- **Status-Digest** (Cron): Läuft z. B. um 10:00 und 21:00. Sammelt alle **Status-Änderungen** der letzten 12 Stunden (aus `MovieStatusChange`). Nur User mit aktivierten E-Mail-Benachrichtigungen und passenden **Status-Präferenzen** (z. B. „bei UPLOADED benachrichtigen“) erhalten eine E-Mail mit der Zusammenfassung (welche Filme sich wie geändert haben). In der Mail steckt ein Link **„Im Browser anzeigen“** – tokenbasiert, gültig 7 Tage – der die gleiche HTML-Ansicht ohne Login öffnet. Anschließend werden die verarbeiteten Änderungen als „geliefert“ markiert. Zusätzlich kann ein **Discord-Webhook** (optional) für UPLOADED/ARCHIVED genutzt werden (eigener Zeitfenster-Catch-up).  
  **Spam-/Reduktionslogik:** Pro Film werden die Roh-Änderungen gefiltert, damit die Mail nicht mit vielen Einzelschritten voll läuft: (1) **Burst:** Mehrere Änderungen innerhalb von 5 Minuten zählen als ein Schub – nur der **letzte** Status in diesem Fenster wird übernommen. (2) **Doppelte** aufeinanderfolgende Status werden übersprungen. (3) **Oszillation:** Wenn ein Status erneut auftaucht und der vorherige ein anderer war (z. B. A→B→A), wird der Zyklus nicht erneut ausgegeben. (4) **Obergrenze:** Pro Film werden maximal 7 Schritte angezeigt; bei mehr erscheinen nur die ersten zwei, ein Platzhalter „… (n weitere)“ und die letzten zwei.

### Authentifizierung & Rollen

- **Rollen:** Admin, Editor, Nutzer (Berechtigungen für Import, API-Keys, Admin-Bereiche)
- **Login:** E-Mail/Passwort (Argon2, optional Pepper)
- **2FA (TOTP):** Authenticator-App, Backup-Codes, **vertrauenswürdige Geräte** (30 Tage ohne 2FA-Code)
- **Passkeys (WebAuthn/FIDO2):** Anmeldung ohne Passwort (Fingerabdruck, Gesicht, Security Key), Verwaltung im Dashboard (hinzufügen, umbenennen, entfernen)
- **Angemeldete Geräte:** Übersicht und Widerruf im Profil

### Sicherheit

- **CSRF-Schutz** für sensible Aktionen (Passwort, 2FA, Passkeys, API-Keys, Admin)
- **Rate-Limiting & Account-Lock:** Brute-Force-Schutz bei Login/2FA (pro IP und pro Account, Fenster 15 Min; bei Überschreitung temporäre Sperre)
- **Trusted-Device-Toleranz:** Fehlversuche von vertrauenswürdigen Geräten werden nicht für Lock gezählt
- **Admin Security-Report:** Fehlversuche, gesperrte Accounts, Übersicht
- **API v1:** Challenge-Response-Auth (kein Passwort im Request), SSH-Key-Signatur

### API & Integration

- **API v1:** Filme abfragen (Challenge-Response, SSH-Key)
- **OpenAPI-Dokumentation** (Swagger UI) unter `/api-docs`
- **API-Keys** (Editor-Rolle): Verwaltung im Dashboard

### Dashboard

- **Übersicht**, **Statistiken**
- **Profil:** Avatar, Banner, Name, E-Mail, Quick Actions, Angemeldete Geräte, E-Mail-Benachrichtigungen
- **Sicherheit:** Passwort ändern, **2FA & Passkeys**, API Key (für Editor)
- **Import:** Filme, Serien (Editor)
- **Admin:** Benutzerverwaltung, Security-Report, Bulk Refetch (Meta & Bilder)

---

## Tech-Stack

| Bereich            | Technologie                         |
|--------------------|-------------------------------------|
| Frontend/Backend   | Next.js 16 (App Router, Standalone)|
| UI                 | React 19, Tailwind CSS 4            |
| Datenbank          | PostgreSQL (Prisma 7)               |
| Cache/Session      | Redis (ioredis)                     |
| Storage            | Cloudflare R2 (S3-kompatibel, AWS SDK) |
| Auth               | Argon2, TOTP (otplib), WebAuthn (@simplewebauthn) |
| E-Mail             | Nodemailer (SMTP)                   |
| Cron/Jobs          | node-cron (Session-Cleanup, Digest, Warmup, Status-Scheduled) |
| Tests              | Vitest                              |
| Lint               | ESLint (eslint-config-next, typescript-eslint) |

---

## Sicherheitsaspekte (Überblick)

| Thema              | Umsetzung |
|--------------------|-----------|
| Passwörter         | Argon2 (Time/Memory Cost konfigurierbar), optional Datei-Pepper |
| 2FA                | TOTP (RFC 6238), Backup-Codes, vertrauenswürdige Geräte (Cookie, 30 Tage) |
| Passkeys           | WebAuthn/FIDO2; Challenges in Redis (TTL 5 Min); rpID/Origin aus Request (Dev: localhost) |
| Sessions           | Server-seitig (Redis), Session-Cleanup per Cron |
| CSRF               | Token-basiert für Passwort, 2FA, Passkeys, API-Keys, Admin-Aktionen; **Rolling Codes:** Nach jeder erfolgreichen sensiblen Aktion wird ein neuer Token erzeugt, in der Session gespeichert und in der Response mitgeliefert – der Client aktualisiert seinen Cache, ein einmal verwendeter Token ist damit ungültig (Replay-Schutz). |
| Login/2FA          | Rate-Limit pro IP und pro Account, Account-Lock nach Fehlversuchen, Trusted-Device-Ausnahme |
| API v1             | Challenge-Response, Signatur mit SSH-Key (kein Passwort-Transport) |
| Admin              | Security-Report (Fehlversuche, Sperren), Rollen-basierter Zugriff |

---

## Entwicklung

### Voraussetzungen

- Node.js 20+
- PostgreSQL
- Redis (Session, Cache, WebAuthn-Challenges)

### Setup

1. Repo klonen, Abhängigkeiten installieren:

   ```bash
   npm ci
   ```

2. `.env` aus `.env.example` anlegen und anpassen. Mindestens:
   - **DB:** `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (oder `DATABASE_URL`)
   - **Redis:** `REDIS_HOST`, ggf. `REDIS_PASS`, `REDIS_PORT` (oder `REDIS_URL`)
   - **Auth:** `SESSION_SECRET` (bzw. `SESSION_SECRET_DEV` für lokale Dev)
   - **TMDb:** `TMDB_API_KEY`
   - **E-Mail:** `SMTP_*` (für Benachrichtigungen)
   - Optional: R2 (`R2_*`), Discord-Webhook, Warmup, Argon2/Pepper, 2FA (siehe `.env.example`)

3. Datenbank: Prisma Client erzeugen und Migrations anwenden:

   ```bash
   npm run db:generate
   npm run db:migrate:deploy
   ```

4. Dev-Server starten:

   ```bash
   npm run dev
   ```

   App: [http://localhost:3000](http://localhost:3000)

### Wichtige Skripte

| Befehl | Beschreibung |
|--------|--------------|
| `npm run dev` | Next.js Dev-Server |
| `npm run build` | Production-Build (Standalone) |
| `npm run start` | Production-Server (nach Build) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (einmal) |
| `npm run test:watch` | Vitest (Watch) |
| `npm run db:generate` | Prisma Client erzeugen |
| `npm run db:push` | Schema ohne Migration anwenden (Dev) |
| `npm run db:migrate` | Prisma Migrate (Dev, interaktiv) |
| `npm run db:migrate:deploy` | Migrations anwenden (Deploy) |
| `npm run db:studio` | Prisma Studio (DB-GUI) |
| `npm run db:import-mysql` | Migration von MySQL zu PostgreSQL (Script) |
| `npm run db:link-collections` | Filme nachträglich Collections zuordnen (TMDb) |
| `npm run generate:server-actions-key` | NEXT_SERVER_ACTIONS_ENCRYPTION_KEY erzeugen |

---

## CI (GitHub Actions)

| Workflow | Trigger | Beschreibung |
|----------|---------|--------------|
| **Staging** | Push auf `main` | Lint, Test parallel → Build (inkl. `.next/static` im Standalone) → Staging-Report (Grok, Discord); bei Erfolg startet Deploy |
| **Deploy** | Staging erfolgreich | SSH: Git pull, **Vollrebuild auf dem Server** (`deploy.sh` ohne SKIP_BUILD), PM2 restart; Discord-Benachrichtigung |
| **Deploy Full Rebuild** | Manuell | Wie Deploy, für Redeploy ohne neuen Push |
| **Clear GitHub Cache** | Manuell | Löscht alle GitHub Actions Caches (z. B. bei inkonsistentem Build) |
| **Security Report** | Wöchentlich (Mo 09:00 UTC), manuell | `npm audit`, Vitest, Grok-Einschätzung, Versand an Discord |

Secrets (Auswahl): `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_KEY`, `APP_DIR`, `DISCORD_STAGING_WEBHOOK`, `DISCORD_SECURITY_WEBHOOK`, `GROK_API_*`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

---

## Deployment (PM2 auf eigenem Server)

Ohne Docker: Node 20+, PostgreSQL, Redis und **PM2** auf dem Server. Nach Push auf `main` laufen Staging und danach Deploy (Vollrebuild per SSH).

### Ablauf

1. **Staging** (CI): Lint, Test, Build.
2. **Deploy** (CI): SSH → `git pull` → `deploy.sh` (ohne SKIP_BUILD).  
   `deploy.sh` führt aus: `npm ci`, Prisma generate/migrate, `next build`, **Kopieren von `.next/static` und `public` ins Standalone**, PM2 restart.

### Einmalig auf dem Server

1. Repo klonen (z. B. `/opt/cinevault/app`), `.env` anlegen (siehe `.env.example`).
2. **Node 20+** und **PM2** installieren (z. B. `npm i -g pm2` oder über nvm).
3. **PostgreSQL** und **Redis** laufen lassen.
4. Einmal manuell deployen:
   ```bash
   cd /opt/cinevault/app
   ./deploy.sh
   ```
   Danach läuft die App unter PM2 (Name: `cinevaultv2`). Port z. B. 3000; davor ggf. Nginx als Reverse Proxy.

### Start auf dem Server

- **ecosystem.config.cjs** startet `scripts/start-standalone.cjs` (lädt `.env` aus Projektroot, führt `node server.js` in `.next/standalone` aus).

---

## Projektstruktur (Auszug)

```
├── .github/workflows/   # staging.yml, deploy.yml, deploy-full-rebuild.yml,
│                        # clear-cache.yml, security-report.yml
├── prisma/              # Schema, Migrations
├── scripts/             # deploy-discord.mjs, check-standalone-static.sh,
│                        # link-movie-collections, migrate-mysql-to-postgres, …
├── src/
│   ├── app/             # App Router
│   │   ├── api/         # auth (login, 2fa, passkey, logout), admin, dashboard,
│   │   │                # v1, openapi, docs-view, csrf, …
│   │   ├── dashboard/   # Übersicht, Profil, Sicherheit (2FA & Passkeys), API-Key,
│   │   │                # Import, Admin (Users, Security, Bulk Refetch)
│   │   ├── login/       # Login, 2FA, PasskeyLoginButton
│   │   ├── movies/, series/, collections/
│   │   ├── digest/      # Digest-View (tokenbasiert)
│   │   └── api-docs/    # OpenAPI-Docs
│   ├── components/      # Wiederverwendbare React-Komponenten
│   └── lib/             # db, auth, session, storage, webauthn, webauthn-challenge,
│                        # csrf, password, two-factor, login-rate-limit, digest-job,
│                        # cdn-warmup, status-scheduled-job, instrumentation (cron), …
├── package.json
├── next.config.ts       # output: "standalone"
├── deploy.sh
└── ecosystem.config.cjs
```

---

## Lizenz

Privates Projekt – keine öffentliche Lizenz.
