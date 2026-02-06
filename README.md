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

| Bereich        | Technologie                    |
|----------------|--------------------------------|
| Frontend/Backend | Next.js 16 (App Router)      |
| Datenbank     | PostgreSQL (Prisma)            |
| Cache/Session | Redis (ioredis)                |
| Storage       | Cloudflare R2 (S3-kompatibel)  |
| E-Mail        | Nodemailer (SMTP)              |
| Deployment    | Docker, Nginx (Reverse Proxy)  |

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

2. `.env` aus `.env.example` anlegen und anpassen (mindestens `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `TMDB_API_KEY`).

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

## Deployment (Docker)

Der Stack läuft mit **Docker Compose**: App, Postgres, Redis und **Nginx** (Reverse Proxy mit Cache).

1. `.env` auf dem Server anlegen (siehe `.env.docker.example` + `.env.example`).
2. Stack starten:

   ```bash
   docker compose up -d --build
   ```

   Zugriff über **Nginx** (Port 80); die App ist nur intern erreichbar.

### Inhalte des Stacks

- **postgres** – PostgreSQL 17 (Volume `postgres_data`)
- **redis** – Redis 7 (Volume `redis_data`)
- **app** – Next.js (Standalone), Prisma Migrations beim Start; Start-Log auf Host unter `./app-logs/start.log` (siehe Abschnitt „Logs bei 502 / Restart-Loop“)
- **nginx** – Reverse Proxy, Cache für `/_next/static`, `/assets` (Volumes: `./nginx/conf.d`, `nginx_cache`, `nginx_logs`)

Nginx-Config ist unter `nginx/conf.d/` editierbar; nach Änderung: `docker compose restart nginx`.

### Deploy per GitHub Actions

Bei Push auf `main` wird per SSH auf dem Server `deploy.sh` ausgeführt (Git Pull + `docker compose up -d --build`). Benötigte Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_KEY`, `APP_DIR`. Siehe `.github/workflows/deploy.yml`.

### Logs bei 502 / Restart-Loop

Wenn du **502** siehst oder der **App-Container** ständig neu startet (`docker ps` zeigt `cinevault-app` im Restart-Loop), schreibt der Entrypoint trotzdem in eine Datei auf dem Host:

```bash
cd APP_DIR   # dein Projektverzeichnis auf dem Server
cat app-logs/start.log
```

Darin siehst du, ob der Container gestartet ist, ob **Prisma Migrations** durchlaufen und wo es ggf. abbricht (z. B. fehlende `DATABASE_URL`, Migrations-Fehler, Node-Start). Auch bei sofortigem Absturz bleibt mindestens die Zeile `=== Container CMD started ===` in der Datei.

- **Migrations-Fehler:** `.env` prüfen (`POSTGRES_*`, `DATABASE_URL` wird von docker-compose aus `POSTGRES_*` gesetzt).
- **Keine Logs in `docker compose logs app`:** Nutze `app-logs/start.log` wie oben.

---

## Projektstruktur (Auszug)

```
├── prisma/           # Schema, Migrations
├── src/
│   ├── app/          # App Router (Seiten, API-Routen)
│   ├── components/   # React-Komponenten
│   └── lib/          # DB, Auth, Storage, TMDb, E-Mail, etc.
├── nginx/            # Nginx-Config (Proxy, Cache)
├── Dockerfile
├── docker-compose.yml
└── deploy.sh
```

---

## Lizenz

Privates Projekt – keine öffentliche Lizenz.
