/**
 * CDN-Warmup (Precache): Ruft öffentliche R2-URLs per GET auf,
 * damit Cloudflare sie am Edge cacht → schnellere Ladezeiten für Nutzer.
 *
 * Nutzt WARMUP_* aus der Umgebung (z. B. für Scheduler).
 * Optional: Redis-Cache, um kürzlich gewarmte URLs zu überspringen.
 */

import { cacheGet, cacheSet } from "./cache";
import { DEBUG_WARMUP, WARMUP_CONCURRENCY } from "./env";
import { toPublicUrl } from "./storage";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type WarmOpts = {
  timeoutMs?: number;
  retries?: number;
  backoffBaseMs?: number;
  /** Wenn gesetzt: URL in Redis als „gerade gewarmt“ markieren (TTL Sekunden), um Doppel-Warmup zu reduzieren. */
  skipRecentlyWarmedTtlSeconds?: number;
};

/**
 * Parallele Map mit begrenzter Concurrency.
 */
async function pMap<T, R>(
  items: T[],
  worker: (item: T, i: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const out: R[] = [];
  let idx = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = idx++;
        if (i >= items.length) break;
        try {
          out[i] = await worker(items[i], i);
        } catch (e) {
          if (DEBUG_WARMUP) {
            console.warn("[precache] fail:", (e as Error)?.message);
          }
        }
      }
    }
  );
  await Promise.all(runners);
  return out;
}

const REDIS_PRECACHE_WARMED_PREFIX = "precache:warmed:";

async function warmUrl(url: string, opts: WarmOpts = {}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const retries = opts.retries ?? 3;
  const backoff = opts.backoffBaseMs ?? 500;
  const skipTtl = opts.skipRecentlyWarmedTtlSeconds ?? 0;

  if (skipTtl > 0) {
    const cacheKey = `${REDIS_PRECACHE_WARMED_PREFIX}${url}`;
    const recently = await cacheGet<string>(cacheKey);
    if (recently === "1") return;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: ctrl.signal,
        headers: {
          Accept: "image/*,*/*;q=0.8",
          "User-Agent": "CineVault-Warmup/1.0 (+cdn)",
        },
      });

      if ((res.status >= 200 && res.status < 300) || res.status === 304) {
        clearTimeout(to);
        if (skipTtl > 0) {
          await cacheSet(
            `${REDIS_PRECACHE_WARMED_PREFIX}${url}`,
            "1",
            skipTtl
          );
        }
        return;
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const jitter = Math.floor(Math.random() * 200);
          const wait = Math.min(10_000, backoff * 2 ** attempt) + jitter;
          clearTimeout(to);
          await sleep(wait);
          continue;
        }
      }

      const body = await res.text().catch(() => "");
      clearTimeout(to);
      throw new Error(
        `HTTP ${res.status} for ${url}${body ? " - " + body.slice(0, 80) : ""}`
      );
    } catch (err: unknown) {
      clearTimeout(to);
      const e = err as { name?: string; message?: string; code?: string };
      const isAbort =
        e?.name === "AbortError" || /aborted/i.test(String(e?.message ?? ""));
      if (
        (isAbort || e?.code === "ECONNRESET" || e?.code === "ETIMEDOUT") &&
        attempt < retries
      ) {
        const jitter = Math.floor(Math.random() * 200);
        const wait = Math.min(12_000, backoff * 2 ** attempt) + jitter;
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

/**
 * R2-Keys → Public-URLs → GET auf jede URL (CDN-Warmup).
 * @param keys R2-Objektschlüssel (z. B. tmdb/w500/xyz.jpg)
 * @param concurrency Parallele Requests (Standard aus WARMUP_CONCURRENCY)
 * @param options Timeout, Retries, optional skipRecentlyWarmedTtlSeconds
 */
export async function warmKeys(
  keys: (string | null | undefined)[],
  concurrency?: number,
  options?: WarmOpts
): Promise<void> {
  const conc = concurrency ?? WARMUP_CONCURRENCY;

  const urls = Array.from(
    new Set(
      keys
        .filter((k): k is string => !!k && typeof k === "string")
        .map((k) => toPublicUrl(k))
        .filter((u): u is string => !!u)
    )
  );

  if (!urls.length) return;

  const batchSize = 200;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await pMap(batch, (u) => warmUrl(u, options), conc);
    if (i + batchSize < urls.length) await sleep(500);
  }
}

/**
 * Bequem-Wrapper: Records mit posterUrl / backdropUrl / coverUrl.
 */
export async function warmFromRecords(
  records: Array<{
    posterUrl?: string | null;
    backdropUrl?: string | null;
    coverUrl?: string | null;
  }>,
  concurrency?: number,
  options?: WarmOpts
): Promise<void> {
  const keys: string[] = [];
  for (const r of records) {
    if (r.posterUrl) keys.push(r.posterUrl);
    if (r.backdropUrl) keys.push(r.backdropUrl);
    if (r.coverUrl) keys.push(r.coverUrl);
  }
  await warmKeys(keys, concurrency, options);
}

/**
 * Generisch: beliebige Felder (z. B. posterUrl, stillUrl, backdropUrl).
 */
export async function warmFromKeys(
  records: Array<Record<string, string | null | undefined>>,
  keyFields: string[],
  concurrency?: number,
  options?: WarmOpts
): Promise<void> {
  const keys: string[] = [];
  for (const r of records) {
    for (const field of keyFields) {
      const val = r[field];
      if (typeof val === "string" && val.trim()) keys.push(val);
    }
  }
  await warmKeys(keys, concurrency, options);
}
