/**
 * Film-Detail: laden mit Redis-Cache, Public-URLs, UI-Formatierung.
 * Entspricht der Logik aus dem alten movie.ts.
 */

import { prisma } from "@/lib/db";
import { toPublicUrl } from "@/lib/storage";
import { cacheGetOrSet } from "@/lib/cache";
import {
  statusLabel,
  priorityLabel,
  mediaTypeLabel,
  genreLabel,
} from "@/lib/enum-mapper";
import type {
  Genre,
  MediaType as MediaTypeT,
  Status as StatusT,
} from "@/generated/prisma/enums";
import { MediaType, Status } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const MOVIE_DETAIL_TTL = 60;

function fmtDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
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

export type MovieDetailUi = {
  sizeBefore: string | null;
  sizeAfter: string | null;
  savingsPct: string | null;
  vbSentAt: string | null;
  vbReceivedAt: string | null;
  statusScheduledAt: string | null;
  addedAt: string | null;
  statusLabel: string;
  priorityLabel: string;
  mediaTypeLabel: string;
  genresText: string | null;
  assignedToName: string | null;
  videobusterUrl: string | null;
  checkSum: string | null;
  quality: string | null;
};

export type MovieDetail = {
  id: number;
  title: string;
  releaseYear: number;
  runtimeMin: number;
  posterUrl: string | null;
  backdropUrl: string | null;
  accentColor: string | null;
  accentColorBackdrop: string | null;
  tmdbId: number | null;
  tagline: string | null;
  overview: string | null;
  status: string;
  priority: string;
  mediaType: string | null;
  fsk: number | null;
  quality: string | null;
  videobusterUrl: string | null;
  vbSentAt: Date | null;
  vbReceivedAt: Date | null;
  statusScheduledAt: Date | null;
  addedAt: Date;
  sizeBeforeBytes: bigint | null;
  sizeAfterBytes: bigint | null;
  checkSum: string | null;
  collectionId: number | null;
  collection: { id: number; name: string; accentColor: string | null } | null;
  assignedToUser: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
  genres: { genre: Genre }[];
  files: { resolution: string | null; codec: string | null; audio: string | null }[];
  ui: MovieDetailUi;
};

const pub = (u: string | null | undefined) => toPublicUrl(u) ?? null;

/**
 * Lädt einen Film inkl. Collection, Files, Genres, AssignedUser.
 * Ergebnis wird in Redis gecacht (MOVIE_DETAIL_TTL Sekunden).
 */
export async function getMovieById(id: number): Promise<MovieDetail | null> {
  const key = `movie:detail:${id}:v1`;
  return cacheGetOrSet(key, MOVIE_DETAIL_TTL, async () => {
    const movie = await prisma.movie.findUnique({
      where: { id },
      include: {
        collection: { select: { id: true, name: true, accentColor: true } },
        files: { select: { resolution: true, codec: true, audio: true } },
        genres: { select: { genre: true } },
        assignedToUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    if (!movie) return null;

    const genresText =
      movie.genres.length > 0
        ? movie.genres
            .map((g) => genreLabel(g.genre))
            .filter(Boolean)
            .join(", ")
        : null;

    const ui: MovieDetailUi = {
      sizeBefore: bytesToGiB(movie.sizeBeforeBytes),
      sizeAfter: bytesToGiB(movie.sizeAfterBytes),
      savingsPct: savingsPercent(movie.sizeBeforeBytes, movie.sizeAfterBytes),
      vbSentAt: fmtDate(movie.vbSentAt),
      vbReceivedAt: fmtDate(movie.vbReceivedAt),
      statusScheduledAt: fmtDate(movie.statusScheduledAt),
      addedAt: fmtDate(movie.addedAt),
      statusLabel: statusLabel(movie.status),
      priorityLabel: priorityLabel(movie.priority),
      mediaTypeLabel: mediaTypeLabel(movie.mediaType),
      genresText,
      assignedToName: movie.assignedToUser?.name ?? null,
      videobusterUrl: movie.videobusterUrl ?? null,
      checkSum: movie.checkSum ?? null,
      quality: movie.quality ?? null,
    };

    return {
      id: movie.id,
      title: movie.title,
      releaseYear: movie.releaseYear,
      runtimeMin: movie.runtimeMin,
      posterUrl: pub(movie.posterUrl),
      backdropUrl: pub(movie.backdropUrl),
      accentColor: movie.accentColor ?? null,
      accentColorBackdrop: movie.accentColorBackdrop ?? null,
      tmdbId: movie.tmdbId ?? null,
      tagline: movie.tagline ?? null,
      overview: movie.overview ?? null,
      status: movie.status,
      priority: movie.priority,
      mediaType: movie.mediaType,
      fsk: movie.fsk ?? null,
      quality: movie.quality ?? null,
      videobusterUrl: movie.videobusterUrl ?? null,
      vbSentAt: movie.vbSentAt,
      vbReceivedAt: movie.vbReceivedAt,
      statusScheduledAt: movie.statusScheduledAt ?? null,
      addedAt: movie.addedAt,
      sizeBeforeBytes: movie.sizeBeforeBytes,
      sizeAfterBytes: movie.sizeAfterBytes,
      checkSum: movie.checkSum ?? null,
      collectionId: movie.collectionId,
      collection: movie.collection,
      assignedToUser: movie.assignedToUser,
      genres: movie.genres,
      files: movie.files,
      ui,
    };
  });
}

/** Invalidiert den Detail-Cache eines Films (z. B. nach Update). */
export async function invalidateMovieCache(id: number): Promise<void> {
  const { cacheDelete } = await import("@/lib/cache");
  await cacheDelete(`movie:detail:${id}:v1`);
}

/** Invalidiert den Filme-Listen-Cache (z. B. nach Update/Delete). */
export async function invalidateMoviesListCache(): Promise<void> {
  const { cacheDelete } = await import("@/lib/cache");
  await cacheDelete("movies:list:default:v1");
}

/** Für Listen-Seite: gleiche Form wie HomeMovie, mit Cache. */
export type MovieListItem = {
  id: number;
  title: string;
  releaseYear: number | null;
  runtimeMin: number | null;
  fsk: number | null;
  accentColor: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  tagline: string | null;
  overview: string;
  status: string;
};

export type MovieListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  mediaType?: string;
  quality?: string;
  yearFrom?: number;
  yearTo?: number;
  hasCollection?: "" | "1" | "0";
  minSize?: string;
  maxSize?: string;
};

export type MovieListResult = {
  items: MovieListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const MOVIES_LIST_TTL = 120;
const MOVIES_LIST_KEY_DEFAULT = "movies:list:default:v1";

function isDefaultMovieListParams(p: MovieListParams): boolean {
  return (
    (p.page === undefined || p.page === 1) &&
    (p.pageSize === undefined || p.pageSize === 24) &&
    !(p.q?.trim()) &&
    !(p.status?.trim()) &&
    !(p.mediaType?.trim()) &&
    !(p.quality?.trim()) &&
    p.yearFrom == null &&
    p.yearTo == null &&
    (p.hasCollection === undefined || p.hasCollection === "") &&
    !(p.minSize?.trim()) &&
    !(p.maxSize?.trim())
  );
}

function buildMovieListWhere(params: MovieListParams): Prisma.MovieWhereInput {
  const and: Prisma.MovieWhereInput[] = [];
  const q = params.q?.trim();
  if (q) and.push({ title: { contains: q } });
  if (params.status && params.status in Status) and.push({ status: params.status as StatusT });
  if (params.mediaType && params.mediaType in MediaType)
    and.push({ mediaType: params.mediaType as MediaTypeT });
  if (params.quality?.trim()) and.push({ quality: { equals: params.quality.trim() } });
  if (params.yearFrom != null || params.yearTo != null) {
    const release: { gte?: number; lte?: number } = {};
    if (params.yearFrom != null) release.gte = params.yearFrom;
    if (params.yearTo != null) release.lte = params.yearTo;
    and.push({ releaseYear: release });
  }
  if (params.hasCollection === "1") and.push({ collectionId: { not: null } });
  if (params.hasCollection === "0") and.push({ collectionId: null });
  const min = params.minSize?.trim() ? BigInt(params.minSize) : null;
  const max = params.maxSize?.trim() ? BigInt(params.maxSize) : null;
  if (min != null || max != null) {
    const bounds: { gte?: bigint; lte?: bigint } = {};
    if (min != null) bounds.gte = min;
    if (max != null) bounds.lte = max;
    and.push({
      OR: [
        { sizeAfterBytes: bounds },
        { AND: [{ sizeAfterBytes: null }, { sizeBeforeBytes: bounds }] },
      ],
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

/**
 * Lädt Filme paginiert/gefiltert für /movies. Cache nur bei Default-Parametern.
 */
export async function getMoviesForListPaginated(
  params: MovieListParams = {}
): Promise<MovieListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(120, Math.max(12, params.pageSize ?? 24));
  const skip = (page - 1) * pageSize;
  const where = buildMovieListWhere(params);

  const run = async () => {
    const [total, rows] = await Promise.all([
      prisma.movie.count({ where }),
      prisma.movie.findMany({
        where,
        orderBy: [{ addedAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          releaseYear: true,
          runtimeMin: true,
          fsk: true,
          accentColor: true,
          posterUrl: true,
          backdropUrl: true,
          tagline: true,
          overview: true,
          status: true,
        },
      }),
    ]);
    const items: MovieListItem[] = rows.map((m) => ({
      id: m.id,
      title: m.title,
      releaseYear: m.releaseYear ?? null,
      runtimeMin: m.runtimeMin ?? null,
      fsk: m.fsk ?? null,
      accentColor: m.accentColor ?? null,
      posterUrl: pub(m.posterUrl),
      backdropUrl: pub(m.backdropUrl),
      tagline: m.tagline ?? null,
      overview: m.overview ?? "",
      status: m.status,
    }));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, total, page, pageSize, totalPages };
  };

  if (isDefaultMovieListParams(params) && page === 1) {
    return cacheGetOrSet(MOVIES_LIST_KEY_DEFAULT, MOVIES_LIST_TTL, run);
  }
  return run();
}

/**
 * Lädt Filme für die Listen-Seite (z. B. /movies). Gecacht; liefert erste Seite (24).
 */
export async function getMoviesForList(): Promise<MovieListItem[]> {
  const { items } = await getMoviesForListPaginated({ page: 1, pageSize: 24 });
  return items;
}
