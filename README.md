# CineVault V2

**CineVault** ist eine persönliche Film- und Serienverwaltung: Du pflegst deine Sammlung (Filme, Serien, Staffeln, Episoden), nutzt Metadaten von [TMDb](https://www.themoviedb.org/) und behältst den Überblick über Status, Qualität und Speicherplatz.

Diese Version (V2) ist ein Neuaufbau mit **Next.js 16**, **Prisma 7**, **PostgreSQL**, **Redis** und optional **Cloudflare R2** für Bilder.

---

## Was CineVault kann

- **Filme & Serien** mit TMDb-Import (Poster, Backdrop, Genres, FSK, Laufzeit)
- **Collections** (Franchises, Themen); Collection wird erst beim zweiten importierten Film angelegt, bestehende Filme werden nachträglich verknüpft
- **Status-Tracking** (Wunschliste, bestellt, verarbeitet, hochgeladen, archiviert)
- **Akzentfarben** aus Postern für ein einheitliches UI
- **Benachrichtigungen** per E-Mail und optional Discord-Webhook bei Status-Änderungen
- **R2/S3-Speicher** für TMDb-Bilder (Pull-Through, keine Duplikate)
- **Rollen & Auth** (Admin, Editor, Nutzer); **2FA** (TOTP, Backup-Codes, vertrauenswürdige Geräte)
- **Sicherheit:** CSRF für sensible Aktionen, Rate-Limiting und Account-Lock bei Login/2FA, Admin Security-Report (Fehlversuche, Sperren)
- **API v1** (Challenge-Response-Auth, Filme abfragen); OpenAPI-Dokumentation
- **Dashboard:** Profil (Avatar, Banner, Name, E-Mail, Benachrichtigungen, Quick Actions, Geräte), 2FA, API-Keys, Import (Filme/Serien), Admin: Nutzer, Security-Report, Bulk-Refetch

---

## Tech-Stack

| Bereich          | Technologie                    |
|------------------|--------------------------------|
| Frontend/Backend | Next.js 16 (App Router)       |
| UI               | React 19, Tailwind CSS 4      |
| Datenbank        | PostgreSQL (Prisma 7)          |
| Cache/Session    | Redis (ioredis)               |
| Storage          | Cloudflare R2 (S3-kompatibel) |
| E-Mail           | Nodemailer (SMTP)              |
| Tests            | Vitest                         |

---

## Entwicklung

### Voraussetzungen

- Node.js 20+
- PostgreSQL
- Redis (Session/Cache)

### Setup

1. Repo klonen, Abhängigkeiten installieren:

   ```bash
   npm ci
   ```

2. `.env` aus `.env.example` anlegen und anpassen. Mindestens:
   - **DB:** `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
   - **Redis:** `REDIS_HOST`, ggf. `REDIS_PASS`, `REDIS_PORT`
   - **Auth:** `SESSION_SECRET` (bzw. `SESSION_SECRET_DEV` für lokale Dev)
   - **TMDb:** `TMDB_API_KEY`
   - **E-Mail:** `SMTP_*` (für Benachrichtigungen)
   - Optional: R2 (`R2_*`), Discord-Webhook, Warmup, 2FA/Pepper (siehe `.env.example`)

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
| `npm run build` | Production-Build |
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

---

## CI (GitHub Actions)

- **Deploy** – Bei Push auf `main`: SSH-Deploy mit `deploy.sh` (Pull, `npm ci`, Prisma, Build, PM2 restart). Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_KEY`, optional `APP_DIR`.
- **Security Report** – Wöchentlich (Mo 09:00 UTC) und manuell: `npm audit` (JSON + Text), Vitest, Grok-Einschätzung (npm audit fix-Empfehlung, Paket-Erklärungen), Versand an Discord. Secrets: `GROK_API_URL`, `GROK_API_KEY`, `GROK_API_MODEL`, `DISCORD_SECURITY_WEBHOOK`.
- **Staging** – Optional: Staging-Checks und Logging-Report.

---

## Deployment (PM2 auf eigenem Server)

Ohne Docker: Node 20+, PostgreSQL, Redis und **PM2** auf dem Server. Nach Push auf `main` deployt GitHub Actions per SSH (`deploy.sh`).

### Einmalig auf dem Server

1. Repo klonen (z. B. `/opt/CineVaultV2`), `.env` anlegen (siehe `.env.example`).
2. **Node 20+** und **PM2** installieren (z. B. `npm i -g pm2` oder über nvm).
3. **PostgreSQL** und **Redis** laufen lassen.
4. Einmal manuell deployen:
   ```bash
   cd /opt/CineVaultV2
   ./deploy.sh
   ```
   Danach läuft die App unter PM2 (Name: `cinevaultv2`). Port z. B. 3000; davor ggf. Nginx als Reverse Proxy.

### Automatischer Deploy (GitHub Actions)

Bei Push auf `main` führt die Action `deploy.sh` per SSH aus. **Secrets** in GitHub: `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_KEY`, optional `APP_DIR` (Default: `/opt/CineVaultV2`).

- **deploy.sh** – Git pull, `npm ci --include=dev`, Prisma generate/migrate, `next build`, PM2 restart (bzw. start beim ersten Mal).
- **ecosystem.config.cjs** – PM2-App `cinevaultv2`, Start: `next start` aus Projektroot.

### Weitere Optionen

- **Vercel** – Repo verbinden, Next.js wird dort gebaut und gehostet.
- **Andere PaaS** – Build: `npm run build`, Start: `npm run start`; `.env` setzen.

---

## Projektstruktur (Auszug)

```
├── .github/workflows/   # deploy.yml, security-report.yml, staging.yml
├── prisma/              # Schema, Migrations
├── scripts/             # link-movie-collections, migrate-mysql-to-postgres,
│                        # security-report-discord.mjs, staging-*
├── security-reports/    # Sicherheitsberichte (v1–v3)
├── src/
│   ├── app/             # App Router
│   │   ├── api/         # API-Routen (auth, admin, dashboard, v1, …)
│   │   ├── dashboard/   # Dashboard (Profil, 2FA, API-Keys, Import, Admin)
│   │   ├── login/       # Login, 2FA
│   │   ├── movies/      # Filme, Detail
│   │   ├── series/      # Serien, Detail
│   │   ├── collections/ # Collections
│   │   └── api-docs/    # OpenAPI-Docs
│   ├── components/      # Wiederverwendbare React-Komponenten
│   └── lib/             # DB, Auth, Session, Storage, TMDb, E-Mail, 2FA, CSRF, …
├── package.json
├── next.config.ts
├── deploy.sh
└── ecosystem.config.cjs
```

---

## Lizenz

Privates Projekt – keine öffentliche Lizenz.
