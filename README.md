# CineVault V2

**CineVault** ist eine persönliche Film- und Serienverwaltung: Du pflegst deine Sammlung (Filme, Serien, Staffeln, Episoden), nutzt Metadaten von [TMDb](https://www.themoviedb.org/) und behältst den Überblick über Status, Qualität und Speicherplatz.

Diese Version (V2) ist ein kompletter Neuaufbau mit **Next.js 16**, **Prisma**, **PostgreSQL**, **Redis** und optional **Cloudflare R2** für Bilder.

---

## Was CineVault kann

- **Filme & Serien** mit TMDb-Import (Poster, Backdrop, Genres, FSK, Laufzeit)
- **Collections** (z. B. Franchises, Themen)
- **Status-Tracking** (Wunschliste, bestellt, verarbeitet, hochgeladen, archiviert)
- **Akzentfarben** aus Postern für ein einheitliches UI
- **Benachrichtigungen** per E-Mail und optional Discord-Webhook bei Status-Änderungen
- **R2/S3-Speicher** für TMDb-Bilder (Pull-Through mit Checksum, keine Duplikate)
- **Rollen & Auth** (Admin, Editor, Nutzer)

---

## Tech-Stack

| Bereich          | Technologie               |
|------------------|---------------------------|
| Frontend/Backend | Next.js 16 (App Router)   |
| Datenbank        | PostgreSQL (Prisma)      |
| Cache/Session    | Redis (ioredis)           |
| Storage          | Cloudflare R2 (S3-kompatibel) |
| E-Mail           | Nodemailer (SMTP)         |

---

## Entwicklung

### Voraussetzungen

- Node.js 20+
- PostgreSQL
- Redis (optional, für Session/Cache)

### Setup

1. Repo klonen, Abhängigkeiten installieren:

   ```bash
   npm ci
   ```

2. `.env` aus `.env.example` anlegen und anpassen (mindestens `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_HOST`/`REDIS_PASS`/`REDIS_PORT`, `SESSION_SECRET`, `TMDB_API_KEY`).

3. Datenbank erstellen und Migrations ausführen:

   ```bash
   npx prisma generate
   npx prisma migrate deploy
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
| `npm run db:generate` | Prisma Client erzeugen |
| `npm run db:migrate:deploy` | Migrations anwenden |
| `npm run db:studio` | Prisma Studio (DB-GUI) |

---

## Deployment (PM2 auf eigenem Server)

Ohne Docker: Node 20+, PostgreSQL, Redis und **PM2** auf dem Server. Nach Push auf `main` deployt GitHub Actions per SSH (`deploy.sh`).

### Einmalig auf dem Server

1. Repo klonen (z. B. `/opt/CineVaultV2`), `.env` anlegen (siehe `.env.example`, u. a. `POSTGRES_*`, `REDIS_*`).
2. **Node 20+** und **PM2** installieren (z. B. `npm i -g pm2` oder über nvm).
3. **PostgreSQL** und **Redis** laufen lassen (lokal oder separat).
4. Einmal manuell deployen:
   ```bash
   cd /opt/CineVaultV2
   ./deploy.sh
   ```
   Danach läuft die App unter PM2 (Name: `cinevaultv2`). Port z. B. 3000; davor ggf. Nginx als Reverse Proxy.

### Automatischer Deploy (GitHub Actions)

Bei Push auf `main` führt die Action `deploy.sh` per SSH aus. **Secrets** in GitHub: `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_KEY`, optional `APP_DIR` (Default: `/opt/CineVaultV2`).

- **deploy.sh** – Git pull, `npm ci --include=dev`, Prisma generate/migrate, `next build`, dann **ein** PM2-Block: `pm2 restart` (bzw. `pm2 start` beim ersten Mal). Kein doppelter Reload, kein `prune`, damit `next start` zuverlässig läuft.
- **ecosystem.config.cjs** – PM2-App `cinevaultv2`, Start: `next start` aus Projektroot (`.env` wird dort geladen).

### Weitere Optionen

- **Vercel** – Repo verbinden, Next.js wird dort gebaut und gehostet.
- **Andere PaaS** – Build: `npm run build`, Start: `npm run start`; `.env` setzen.

---

## Projektstruktur (Auszug)

```
├── prisma/           # Schema, Migrations
├── src/
│   ├── app/          # App Router (Seiten, API-Routen)
│   ├── components/   # React-Komponenten
│   └── lib/          # DB, Auth, Storage, TMDb, E-Mail, etc.
├── package.json
└── next.config.ts
```

---

## Lizenz

Privates Projekt – keine öffentliche Lizenz.
