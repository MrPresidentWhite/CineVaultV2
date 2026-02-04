/**
 * Redis-Client-Singleton für CineVault.
 * Nutzt REDIS_URL und REDIS_PASS aus der Umgebung.
 */

import Redis from "ioredis";
import { REDIS_PASS, REDIS_URL } from "./env";

const globalForRedis = globalThis as unknown as { redis: Redis | null };

function createRedisClient(): Redis | null {
  if (!REDIS_URL || REDIS_URL === "") return null;
  try {
    const client = new Redis(REDIS_URL, {
      password: REDIS_PASS && REDIS_PASS !== "" ? REDIS_PASS : undefined,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });
    client.on("error", (err) => {
      console.warn("[Redis]", err.message);
    });
    return client;
  } catch {
    return null;
  }
}

/**
 * Gibt die gemeinsame Redis-Instanz zurück oder null, wenn Redis nicht konfiguriert ist.
 * Verbindung wird beim ersten Zugriff hergestellt (lazyConnect).
 */
export function getRedis(): Redis | null {
  if (globalForRedis.redis === undefined) {
    globalForRedis.redis = createRedisClient();
  }
  return globalForRedis.redis;
}

/**
 * Schließt die Redis-Verbindung (z. B. beim Shutdown).
 */
export async function closeRedis(): Promise<void> {
  const client = globalForRedis.redis;
  if (client) {
    await client.quit();
    globalForRedis.redis = null;
  }
}
