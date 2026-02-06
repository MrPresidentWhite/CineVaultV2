/**
 * Serien-Detail: laden mit Redis-Cache, Public-URLs, Laufzeiten, UI-Formatierung.
 * Entspricht der Logik aus dem alten series.ts.
 */

import { prisma } from "@/lib/db";
import { toPublicUrl } from "@/lib/storage";
import { cacheGetOrSet } from "@/lib/cache";
import { genreLabelTV } from "@/lib/enum-mapper";
import type { TVGenre } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const SERIES_DETAIL_TTL = 60;
const SERIES_DETAIL_KEY_PREFIX = "series:detail:";
const SERIES_LIST_TTL = 120;
const SERIES_LIST_KEY = "series:list:v1";
const SERIES_LIST_DEFAULT_KEY = "series:list:default:v1";

const pub = (u: string | null | undefined) => toPublicUrl(u) ?? null;

function formatRuntime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function bytesToGiB(n: bigint | null | undefined): string | null {
  if (n == null) return null;
  return `${(Number(n) / 1024 ** 3).toFixed(2)} GB`;
}

function savingsPercent(
  before: bigint | null | undefined,
  after: bigint | null | undefined
): string | null {
  if (before == null || after == null || Number(before) === 0) return null;
  const pct = ((Number(before - after) / Number(before)) * 100).toFixed(1);
  return `${pct} %`;
}

export type SeriesDetailEpisode = {
  id: number;
  seasonId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string | null;
  runtimeMin: number | null;
  airDate: Date | null;
  stillUrl: string | null;
  accentColor: string | null;
  checkSum: string | null;
  sizeBefore: string | null;
  sizeAfter: string | null;
  savingsPct: string | null;
  /** Roh-Bytes für Edit-Formular (JSON-sicher). */
  sizeBeforeBytes: number | null;
  sizeAfterBytes: number | null;
};

export type SeriesDetailSeason = {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string | null;
  posterUrl: string | null;
  airDate: Date | null;
  episodeCount: number | null;
  accentColor: string | null;
  episodes: SeriesDetailEpisode[];
};

export type SeriesDetail = {
  id: number;
  title: string;
  originalTitle: string | null;
  firstAirYear: number | null;
  inProduction: boolean | null;
  statusText: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  accentColor: string | null;
  accentColorBackdrop: string | null;
  tmdbId: number | null;
  homepage: string | null;
  overview: string | null;
  tagline: string | null;
  fsk: number | null;
  status: string;
  priority: string;
  addedAt: Date;
  seasonCount: number;
  totalRuntimeText: string;
  medianRuntimeText: string;
  avgRuntimeText: string;
  genresText: string | null;
  seasons: SeriesDetailSeason[];
};

/**
 * Lädt eine Serie inkl. Seasons und Episoden. Gecacht.
 */
export async function getSeriesById(id: number): Promise<SeriesDetail | null> {
  const key = `${SERIES_DETAIL_KEY_PREFIX}${id}:v1`;
  return cacheGetOrSet(key, SERIES_DETAIL_TTL, async () => {
    const series = await prisma.series.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        originalTitle: true,
        firstAirYear: true,
        inProduction: true,
        statusText: true,
        posterUrl: true,
        backdropUrl: true,
        accentColor: true,
        accentColorBackdrop: true,
        tmdbId: true,
        homepage: true,
        overview: true,
        tagline: true,
        fsk: true,
        status: true,
        priority: true,
        addedAt: true,
        genres: { select: { genre: true } },
        seasons: {
          orderBy: { seasonNumber: "asc" },
          select: {
            id: true,
            seasonNumber: true,
            name: true,
            overview: true,
            posterUrl: true,
            airDate: true,
            episodeCount: true,
            accentColor: true,
          },
        },
      },
    });
    if (!series) return null;

    const allEpisodes = await prisma.episode.findMany({
      where: { seriesId: id },
      select: {
        id: true,
        seasonId: true,
        seasonNumber: true,
        episodeNumber: true,
        title: true,
        overview: true,
        runtimeMin: true,
        airDate: true,
        stillUrl: true,
        accentColor: true,
        checkSum: true,
        sizeBeforeBytes: true,
        sizeAfterBytes: true,
      },
      orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
    });

    const episodesBySeason = new Map<number, typeof allEpisodes>();
    allEpisodes.forEach((ep) => {
      const list = episodesBySeason.get(ep.seasonNumber) ?? [];
      list.push(ep);
      episodesBySeason.set(ep.seasonNumber, list);
    });

    const runtimes = allEpisodes
      .map((ep) => ep.runtimeMin)
      .filter((n): n is number => typeof n === "number" && n > 0)
      .sort((a, b) => a - b);
    const episodeCount = runtimes.length;
    let medianRuntimeMin = 0;
    if (episodeCount > 0) {
      const middle = Math.floor(episodeCount / 2);
      medianRuntimeMin =
        episodeCount % 2
          ? runtimes[middle]
          : Math.round((runtimes[middle - 1] + runtimes[middle]) / 2);
    }
    const totalRuntimeMin = runtimes.reduce((acc, n) => acc + n, 0);
    const avgRuntimeText =
      episodeCount > 0
        ? `Ø ${formatRuntime(Math.round(totalRuntimeMin / episodeCount))}`
        : "–";

    const genresText =
      series.genres.length > 0
        ? series.genres
            .map((g) => genreLabelTV(g.genre))
            .filter(Boolean)
            .join(", ")
        : null;

    const seasons: SeriesDetailSeason[] = series.seasons.map((s) => ({
      id: s.id,
      seasonNumber: s.seasonNumber,
      name: s.name,
      overview: s.overview ?? null,
      posterUrl: pub(s.posterUrl),
      airDate: s.airDate,
      episodeCount: s.episodeCount ?? null,
      accentColor: s.accentColor ?? null,
      episodes: (episodesBySeason.get(s.seasonNumber) ?? []).map((ep) => ({
        id: ep.id,
        seasonId: ep.seasonId,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        overview: ep.overview ?? null,
        runtimeMin: ep.runtimeMin ?? null,
        airDate: ep.airDate,
        stillUrl: pub(ep.stillUrl),
        accentColor: ep.accentColor ?? null,
        checkSum: ep.checkSum ?? null,
        sizeBefore: bytesToGiB(ep.sizeBeforeBytes),
        sizeAfter: bytesToGiB(ep.sizeAfterBytes),
        savingsPct: savingsPercent(ep.sizeBeforeBytes, ep.sizeAfterBytes),
        sizeBeforeBytes: ep.sizeBeforeBytes != null ? Number(ep.sizeBeforeBytes) : null,
        sizeAfterBytes: ep.sizeAfterBytes != null ? Number(ep.sizeAfterBytes) : null,
      })),
    }));

    return {
      id: series.id,
      title: series.title,
      originalTitle: series.originalTitle ?? null,
      firstAirYear: series.firstAirYear ?? null,
      inProduction: series.inProduction ?? null,
      statusText: series.statusText ?? null,
      posterUrl: pub(series.posterUrl),
      backdropUrl: pub(series.backdropUrl),
      accentColor: series.accentColor ?? null,
      accentColorBackdrop: series.accentColorBackdrop ?? null,
      tmdbId: series.tmdbId ?? null,
      homepage: series.homepage ?? null,
      overview: series.overview ?? null,
      tagline: series.tagline ?? null,
      fsk: series.fsk ?? null,
      status: series.status,
      priority: series.priority,
      addedAt: series.addedAt,
      seasonCount: series.seasons.length,
      totalRuntimeText: formatRuntime(totalRuntimeMin),
      medianRuntimeText: formatRuntime(medianRuntimeMin),
      avgRuntimeText,
      genresText,
      seasons,
    };
  });
}

/** Invalidiert den Detail-Cache einer Serie (z. B. nach Update). */
export async function invalidateSeriesCache(id: number): Promise<void> {
  const { cacheDelete } = await import("@/lib/cache");
  await cacheDelete(`${SERIES_DETAIL_KEY_PREFIX}${id}:v1`);
}

/** Für Listen-Seite: gleiche Form wie HomeSeries, mit Cache. */
export type SeriesListItem = {
  id: number;
  title: string;
  firstAirYear: number | null;
  fsk: number | null;
  accentColor: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  tagline: string | null;
  overview: string | null;
  seasonCount: number;
};

export type SeriesListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  yearFrom?: number;
  yearTo?: number;
  sort?:
    | "created_desc"
    | "created_asc"
    | "title_asc"
    | "title_desc"
    | "year_desc"
    | "year_asc"
    | "count_desc"
    | "count_asc";
};

export type SeriesListResult = {
  items: SeriesListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function isDefaultSeriesListParams(p: SeriesListParams): boolean {
  return (
    (p.page === undefined || p.page === 1) &&
    (p.pageSize === undefined || p.pageSize === 24) &&
    !(p.q?.trim()) &&
    p.yearFrom == null &&
    p.yearTo == null &&
    (p.sort === undefined || p.sort === "created_desc")
  );
}

function buildSeriesListWhere(
  params: SeriesListParams
): Prisma.SeriesWhereInput {
  const where: Prisma.SeriesWhereInput = {};
  const q = params.q?.trim();
  if (q) where.title = { contains: q };
  if (params.yearFrom != null || params.yearTo != null) {
    const year: { gte?: number; lte?: number } = {};
    if (params.yearFrom != null) year.gte = params.yearFrom;
    if (params.yearTo != null) year.lte = params.yearTo;
    where.firstAirYear = year;
  }
  return where;
}

function buildSeriesListOrderBy(
  sort: SeriesListParams["sort"]
): Prisma.SeriesOrderByWithRelationInput[] {
  const order: Prisma.SeriesOrderByWithRelationInput[] = [];
  switch (sort) {
    case "title_asc":
      order.push({ title: "asc" });
      break;
    case "title_desc":
      order.push({ title: "desc" });
      break;
    case "created_asc":
      order.push({ createdAt: "asc" });
      break;
    case "created_desc":
      order.push({ createdAt: "desc" });
      break;
    case "year_asc":
      order.push({ firstAirYear: "asc" });
      break;
    case "year_desc":
      order.push({ firstAirYear: "desc" });
      break;
    case "count_desc":
      order.push({ seasons: { _count: "desc" } });
      break;
    case "count_asc":
      order.push({ seasons: { _count: "asc" } });
      break;
    default:
      order.push({ createdAt: "desc" });
  }
  order.push({ id: "asc" });
  return order;
}

/**
 * Lädt Serien paginiert/gefiltert für /series. Cache nur bei Default-Parametern.
 */
export async function getSeriesForListPaginated(
  params: SeriesListParams = {}
): Promise<SeriesListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(120, Math.max(12, params.pageSize ?? 24));
  const skip = (page - 1) * pageSize;
  const where = buildSeriesListWhere(params);
  const orderBy = buildSeriesListOrderBy(params.sort ?? "created_desc");

  const run = async () => {
    const [total, rows] = await Promise.all([
      prisma.series.count({ where }),
      prisma.series.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          firstAirYear: true,
          fsk: true,
          accentColor: true,
          posterUrl: true,
          backdropUrl: true,
          tagline: true,
          overview: true,
          _count: { select: { seasons: true } },
        },
      }),
    ]);
    const items: SeriesListItem[] = rows.map((s) => ({
      id: s.id,
      title: s.title,
      firstAirYear: s.firstAirYear ?? null,
      fsk: s.fsk ?? null,
      accentColor: s.accentColor ?? null,
      posterUrl: pub(s.posterUrl),
      backdropUrl: pub(s.backdropUrl),
      tagline: s.tagline ?? null,
      overview: s.overview ?? null,
      seasonCount: s._count.seasons,
    }));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, total, page, pageSize, totalPages };
  };

  if (isDefaultSeriesListParams(params) && page === 1) {
    return cacheGetOrSet(SERIES_LIST_DEFAULT_KEY, SERIES_LIST_TTL, run);
  }
  return run();
}

/**
 * Lädt Serien für die Listen-Seite (/series). Gecacht; alle ohne Pagination.
 */
export async function getSeriesForList(): Promise<SeriesListItem[]> {
  return cacheGetOrSet(SERIES_LIST_KEY, SERIES_LIST_TTL, async () => {
    const rows = await prisma.series.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        firstAirYear: true,
        fsk: true,
        accentColor: true,
        posterUrl: true,
        backdropUrl: true,
        tagline: true,
        overview: true,
        _count: { select: { seasons: true } },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      title: s.title,
      firstAirYear: s.firstAirYear ?? null,
      fsk: s.fsk ?? null,
      accentColor: s.accentColor ?? null,
      posterUrl: pub(s.posterUrl),
      backdropUrl: pub(s.backdropUrl),
      tagline: s.tagline ?? null,
      overview: s.overview ?? null,
      seasonCount: s._count.seasons,
    }));
  });
}

/** Invalidiert den Serien-Listen-Cache. */
export async function invalidateSeriesListCache(): Promise<void> {
  const { cacheDelete } = await import("@/lib/cache");
  await Promise.all([
    cacheDelete(SERIES_LIST_KEY),
    cacheDelete(SERIES_LIST_DEFAULT_KEY),
  ]);
}
