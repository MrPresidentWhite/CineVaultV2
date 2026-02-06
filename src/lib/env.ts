/**
 * Server-seitige Umgebungsvariablen.
 * DATABASE_URL wird von Prisma (prisma.config.ts) verwendet.
 * REDIS_URL für Redis-Client (z. B. ioredis) bei Session/Cache.
 */

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function getEnvRequired(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

/** Datenbank-URL für Prisma (PostgreSQL). Wird auch in prisma.config.ts gelesen. */
export const DATABASE_URL = getEnv("DATABASE_URL");

/** Umgebung (dev/prod) – z. B. für Dev-Autologin. */
export const ENVIRONMENT = getEnv("ENVIRONMENT") ?? "prod";

/** true wenn Dev-Modus (Autologin, etc.) – akzeptiert dev, development, developement. */
export const isDev = ["dev", "development", "developement"].includes(
  (getEnv("ENVIRONMENT") ?? "prod").toLowerCase()
);

/** Geheimer Schlüssel für Session-Cookie (in Produktion setzen). */
export const SESSION_SECRET =
  getEnv("SESSION_SECRET") ?? "change-me-in-production-please";

/** Secret für Cron-Endpoints (z. B. Session-Cleanup). Vercel setzt es beim Cron-Aufruf als Bearer-Token. */
export const CRON_SECRET = getEnv("CRON_SECRET");

/** Redis-URL für Session/Cache (z. B. redis://127.0.0.1:6379). */
export const REDIS_URL = getEnv("REDIS_URL") ?? "redis://127.0.0.1:6379";

/** Redis-Passwort, falls gesetzt. */
export const REDIS_PASS = getEnv("REDIS_PASS");

/** TMDb API Key (für Film-/Serien-Metadaten). */
export const TMDB_API_KEY = getEnv("TMDB_API_KEY");

/** TMDb Bild-Basis-URL (Standard: offiziell; optional eigener Proxy). */
export const TMDB_IMAGE_BASE_URL =
  getEnv("TMDB_IMAGE_BASE_URL") ?? "https://image.tmdb.org/t/p";

/** App-URL (z. B. für User-Agent, Callbacks). */
export const APP_URL = (getEnv("APP_URL") ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
);

/* --- Cloudflare R2 (S3-kompatibel) --- */
export const R2_ENDPOINT = getEnv("R2_ENDPOINT");
export const R2_BUCKET = getEnv("R2_BUCKET");
export const R2_ACCESS_KEY_ID = getEnv("R2_ACCESS_KEY_ID");
export const R2_SECRET_ACCESS_KEY = getEnv("R2_SECRET_ACCESS_KEY");
export const R2_REGION = getEnv("R2_REGION") ?? "auto";
export const R2_S3_FORCE_PATH_STYLE =
  String(getEnv("R2_S3_FORCE_PATH_STYLE") ?? "true") === "true";
/** Öffentliche Basis-URL für R2-Objekte (z. B. CDN-Domain). */
export const R2_PUBLIC_BASE_URL = getEnv("R2_PUBLIC_BASE_URL") ?? "";
/** R2-Logging nur wenn gesetzt (z. B. DEBUG_R2=1). */
export const DEBUG_R2 = String(getEnv("DEBUG_R2") ?? "0") === "1";

/* --- Cloudflare Cache Purge --- */
export const CLOUDFLARE_API_TOKEN = getEnv("CLOUDFLARE_API_TOKEN");
export const CLOUDFLARE_ZONE_ID = getEnv("CLOUDFLARE_ZONE_ID");

/* --- Warmup / Precache (CDN-Cache füllen) --- */
export const WARMUP_ENABLED = String(getEnv("WARMUP_ENABLED") ?? "0") === "1";
export const WARMUP_INTERVAL_MINUTES = Math.max(
  1,
  parseInt(getEnv("WARMUP_INTERVAL_MINUTES") ?? "30", 10) || 30
);
export const WARMUP_SCOPE = getEnv("WARMUP_SCOPE") ?? "all";
export const WARMUP_LIMIT = Math.max(
  0,
  parseInt(getEnv("WARMUP_LIMIT") ?? "400", 10) || 400
);
export const WARMUP_CONCURRENCY = Math.max(
  1,
  parseInt(getEnv("WARMUP_CONCURRENCY") ?? "10", 10) || 10
);
export const DEBUG_WARMUP = String(getEnv("DEBUG_WARMUP") ?? "0") === "1";

/* --- Argon2 (Passwort-Hashing) --- */
export const ARGON2_TIME_COST = Math.max(
  1,
  parseInt(getEnv("ARGON2_TIME_COST") ?? "3", 10) || 3
);
export const ARGON2_MEMORY_KIB = Math.max(
  1024,
  parseInt(getEnv("ARGON2_MEMORY_KIB") ?? "65536", 10) || 65536
);
export const ARGON2_PARALLELISM = Math.max(
  1,
  parseInt(getEnv("ARGON2_PARALLELISM") ?? "1", 10) || 1
);
export const ARGON2_HASH_LENGTH = Math.max(
  16,
  Math.min(128, parseInt(getEnv("ARGON2_HASH_LENGTH") ?? "32", 10) || 32)
);
/** Optionaler Pepper (geheim halten, bei Rotation alle Passwörter neu hashen). */
export const PASSWORD_PEPPER = getEnv("PASSWORD_PEPPER") ?? "";

/* --- SMTP (E-Mail-Benachrichtigungen) --- */
export const SMTP_HOST = getEnv("SMTP_HOST");
export const SMTP_PORT = Number(getEnv("SMTP_PORT") ?? "587") || 587;
export const SMTP_USER = getEnv("SMTP_USER");
export const SMTP_PASS = getEnv("SMTP_PASS");
export const SMTP_FROM = getEnv("SMTP_FROM") ?? SMTP_USER;
export const SMTP_FROM_NAME = getEnv("SMTP_FROM_NAME");

/* --- Discord Webhook (Status-Digest) --- */
export const DISCORD_WEBHOOK_URL = getEnv("DISCORD_WEBHOOK_URL");

/**
 * Gibt REDIS_URL zurück; wirft, wenn REDIS_URL fehlt und required true ist.
 */
export function getRedisUrl(required = false): string {
  if (required && (!REDIS_URL || REDIS_URL === "")) {
    throw new Error("Missing required env: REDIS_URL");
  }
  return REDIS_URL ?? "";
}

/**
 * Gibt DATABASE_URL zurück; wirft, wenn sie fehlt.
 * Für Migrations/CLI nutzt Prisma prisma.config.ts (dotenv).
 */
export function getDatabaseUrl(): string {
  return getEnvRequired("DATABASE_URL");
}
