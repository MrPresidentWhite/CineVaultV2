/**
 * Caching-Service mit Redis-Backend.
 * Bei fehlendem Redis wird kein Cache verwendet (direkter Aufruf der Factory).
 */

import { getRedis } from "./redis";

const DEFAULT_TTL_SECONDS = 3600;

/**
 * Liest einen Wert aus dem Cache oder ruft die Factory auf, speichert das Ergebnis und gibt es zurück.
 * TTL in Sekunden (Standard 1 Stunde).
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  factory: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch {
      // Bei Redis-Fehler: Factory ausführen
    }
  }
  const value = await factory();
  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // Ignorieren
    }
  }
  return value;
}

/**
 * Setzt einen Wert im Cache (TTL in Sekunden).
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // Ignorieren
    }
  }
}

/**
 * Liest einen Wert aus dem Cache. Gibt undefined zurück, wenn nicht vorhanden oder Redis fehlt.
 */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;
  try {
    const cached = await redis.get(key);
    return cached !== null ? (JSON.parse(cached) as T) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Entfernt einen Schlüssel aus dem Cache.
 */
export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // Ignorieren
    }
  }
}

/**
 * Cache-Präfix für TMDb (z. B. für invalidation).
 */
export const CACHE_PREFIX_TMDB = "tmdb:";
