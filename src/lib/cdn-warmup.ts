/**
 * CDN-Warmup-Job: Lädt die neuesten Poster/Backdrops/Cover/Stills per GET,
 * damit Cloudflare sie am Edge cacht → schnellere Ladezeiten.
 *
 * Wird per node-cron (instrumentation) oder manuell aufgerufen.
 * Nutzt WARMUP_* aus der Umgebung als Defaults.
 *
 * Optimierungen:
 * - Jeder Scope (movies/collections/series) in try/catch → ein Fehler bricht nicht den ganzen Lauf ab
 * - Kurze Pause zwischen Scopes → weniger Lastspitzen, schonender für CDN/DB
 * - Rückgabe inkl. errors[] für bessere Beobachtbarkeit
 */

import { prisma } from "@/lib/db";
import { warmFromRecords, warmFromKeys } from "@/lib/precache";
import {
  WARMUP_CONCURRENCY,
  WARMUP_LIMIT,
  WARMUP_SCOPE,
} from "@/lib/env";

export type CdnWarmupScope = "movies" | "collections" | "series" | "all";

export type RunCdnWarmupOpts = {
  scope?: CdnWarmupScope;
  limit?: number;
  concurrency?: number;
  /** Pause in ms zwischen den Scopes (Default 1500). 0 = deaktiviert. */
  pauseBetweenScopesMs?: number;
};

export type RunCdnWarmupResult = {
  warmed: number;
  scope: CdnWarmupScope;
  limit: number;
  concurrency: number;
  errors: string[];
};

const DEFAULT_PAUSE_BETWEEN_SCOPES_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function countNonNullKeys(
  rows: Array<Record<string, unknown>>,
  keys: string[]
): number {
  return rows.reduce(
    (sum, r) =>
      sum + keys.reduce((kSum, k) => kSum + (r[k] ? 1 : 0), 0),
    0
  );
}

export async function runCdnWarmup(opts?: RunCdnWarmupOpts): Promise<RunCdnWarmupResult> {
  const rawScope = (opts?.scope ?? WARMUP_SCOPE) as string;
  const scope: CdnWarmupScope =
    rawScope === "both"
      ? "all"
      : rawScope === "movies" || rawScope === "collections" || rawScope === "series" || rawScope === "all"
        ? rawScope
        : "all";

  const limit = Math.min(
    Math.max(opts?.limit ?? WARMUP_LIMIT, 1),
    5000
  );
  const concurrency = Math.min(
    Math.max(opts?.concurrency ?? WARMUP_CONCURRENCY, 1),
    24
  );
  const pauseMs = Math.max(0, opts?.pauseBetweenScopesMs ?? DEFAULT_PAUSE_BETWEEN_SCOPES_MS);

  let warmedKeys = 0;
  const errors: string[] = [];

  const run = async (label: string, fn: () => Promise<number>): Promise<void> => {
    try {
      const n = await fn();
      warmedKeys += n;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${label}: ${msg}`);
    }
  };

  if (scope === "movies" || scope === "all") {
    await run("movies", async () => {
      const movies = await prisma.movie.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit,
        select: { posterUrl: true, backdropUrl: true },
      });
      await warmFromRecords(movies, concurrency);
      return countNonNullKeys(movies, ["posterUrl", "backdropUrl"]);
    });
    if (pauseMs > 0 && scope === "all") await sleep(pauseMs);
  }

  if (scope === "collections" || scope === "all") {
    await run("collections", async () => {
      const cols = await prisma.collection.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit,
        select: { posterUrl: true, backdropUrl: true, coverUrl: true },
      });
      await warmFromRecords(cols, concurrency);
      return countNonNullKeys(cols, [
        "posterUrl",
        "backdropUrl",
        "coverUrl",
      ]);
    });
    if (pauseMs > 0 && scope === "all") await sleep(pauseMs);
  }

  if (scope === "series" || scope === "all") {
    await run("series", async () => {
      const series = await prisma.series.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit,
        select: { posterUrl: true, backdropUrl: true },
      });
      await warmFromRecords(series, concurrency);
      let n = countNonNullKeys(series, ["posterUrl", "backdropUrl"]);

      const seasons = await prisma.season.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit,
        select: { posterUrl: true },
      });
      await warmFromRecords(seasons, concurrency);
      n += countNonNullKeys(seasons, ["posterUrl"]);

      const episodes = await prisma.episode.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit,
        select: { stillUrl: true },
      });
      await warmFromKeys(episodes, ["stillUrl"], concurrency);
      n += episodes.reduce((sum, e) => sum + (e.stillUrl ? 1 : 0), 0);

      return n;
    });
  }

  return { warmed: warmedKeys, scope, limit, concurrency, errors };
}
