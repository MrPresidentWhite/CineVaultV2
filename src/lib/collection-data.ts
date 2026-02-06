/**
 * Collection-Detail: laden mit Redis-Cache, Public-URLs.
 * Entspricht der Logik aus dem alten collection.ts.
 */

import { prisma } from "@/lib/db";
import { toPublicUrl } from "@/lib/storage";
import { cacheGetOrSet } from "@/lib/cache";
import type { Prisma } from "@/generated/prisma/client";

const COLLECTION_DETAIL_TTL = 60;
const COLLECTION_DETAIL_KEY_PREFIX = "collection:detail:";
const COLLECTIONS_LIST_TTL = 120;
const COLLECTIONS_LIST_KEY = "collections:list:v1";
const COLLECTIONS_LIST_DEFAULT_KEY = "collections:list:default:v1";

const pub = (u: string | null | undefined) => toPublicUrl(u) ?? null;

export type CollectionDetailMovie = {
  id: number;
  title: string;
  releaseYear: number;
  posterUrl: string | null;
  backdropUrl: string | null;
  accentColor: string | null;
  fsk: number | null;
  runtimeMin: number;
  tagline: string | null;
  overview: string;
  status: string;
};

export type CollectionDetail = {
  id: number;
  name: string;
  posterUrl: string | null;
  coverUrl: string | null;
  backdropUrl: string | null;
  accentColor: string | null;
  accentColorBackdrop: string | null;
  overview: string | null;
  movies: CollectionDetailMovie[];
};

/**
 * Lädt eine Collection inkl. Filme (nach releaseYear sortiert). Gecacht.
 */
export async function getCollectionById(
  id: number
): Promise<CollectionDetail | null> {
  const key = `${COLLECTION_DETAIL_KEY_PREFIX}${id}:v1`;
  return cacheGetOrSet(key, COLLECTION_DETAIL_TTL, async () => {
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        movies: {
          orderBy: { releaseYear: "asc" },
          select: {
            id: true,
            title: true,
            releaseYear: true,
            posterUrl: true,
            backdropUrl: true,
            accentColor: true,
            fsk: true,
            runtimeMin: true,
            tagline: true,
            overview: true,
            status: true,
          },
        },
      },
    });
    if (!collection) return null;

    const movies: CollectionDetailMovie[] = collection.movies.map((m) => ({
      id: m.id,
      title: m.title,
      releaseYear: m.releaseYear,
      posterUrl: pub(m.posterUrl),
      backdropUrl: pub(m.backdropUrl),
      accentColor: m.accentColor ?? null,
      fsk: m.fsk ?? null,
      runtimeMin: m.runtimeMin,
      tagline: m.tagline ?? null,
      overview: m.overview ?? "",
      status: m.status,
    }));

    return {
      id: collection.id,
      name: collection.name,
      posterUrl: pub(collection.posterUrl),
      coverUrl: pub(collection.coverUrl),
      backdropUrl: pub(collection.backdropUrl),
      accentColor: collection.accentColor ?? null,
      accentColorBackdrop: collection.accentColorBackdrop ?? null,
      overview: collection.overview ?? null,
      movies,
    };
  });
}

/** Invalidiert den Detail-Cache einer Collection (z. B. nach Refetch). */
export async function invalidateCollectionCache(id: number): Promise<void> {
  const { cacheDelete } = await import("@/lib/cache");
  await cacheDelete(`${COLLECTION_DETAIL_KEY_PREFIX}${id}:v1`);
}

/** Invalidiert den Listen-Cache (z. B. nach Refetch einer Collection). */
export async function invalidateCollectionsListCache(): Promise<void> {
  const { cacheDelete } = await import("@/lib/cache");
  await Promise.all([
    cacheDelete(COLLECTIONS_LIST_KEY),
    cacheDelete(COLLECTIONS_LIST_DEFAULT_KEY),
  ]);
}

/** Für Listen-Seite: gleiche Form wie HomeCollection, mit Cache. */
export type CollectionListItem = {
  id: number;
  name: string;
  coverUrl: string | null;
  accentColor: string | null;
  overview: string | null;
  movieCount: number;
};

export type CollectionListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  hasPoster?: "any" | "yes" | "no";
  hasCover?: "any" | "yes" | "no";
  hasBackdrop?: "any" | "yes" | "no";
  minOneMovie?: boolean;
  sort?:
    | "name_asc"
    | "name_desc"
    | "created_desc"
    | "created_asc"
    | "count_desc"
    | "count_asc";
};

export type CollectionListResult = {
  items: CollectionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function isDefaultCollectionListParams(p: CollectionListParams): boolean {
  return (
    (p.page === undefined || p.page === 1) &&
    (p.pageSize === undefined || p.pageSize === 24) &&
    !(p.q?.trim()) &&
    (p.hasPoster === undefined || p.hasPoster === "any") &&
    (p.hasCover === undefined || p.hasCover === "any") &&
    (p.hasBackdrop === undefined || p.hasBackdrop === "any") &&
    !p.minOneMovie &&
    (p.sort === undefined || p.sort === "created_desc")
  );
}

function buildCollectionListWhere(
  params: CollectionListParams
): Prisma.CollectionWhereInput {
  const where: Prisma.CollectionWhereInput = {};
  const q = params.q?.trim();
  if (q) where.name = { contains: q };
  if (params.hasPoster === "yes") where.posterUrl = { not: null };
  if (params.hasPoster === "no") where.posterUrl = null;
  if (params.hasCover === "yes") where.coverUrl = { not: null };
  if (params.hasCover === "no") where.coverUrl = null;
  if (params.hasBackdrop === "yes") where.backdropUrl = { not: null };
  if (params.hasBackdrop === "no") where.backdropUrl = null;
  if (params.minOneMovie) where.movies = { some: {} };
  return where;
}

function buildCollectionListOrderBy(
  sort: CollectionListParams["sort"]
): Prisma.CollectionOrderByWithRelationInput[] {
  const order: Prisma.CollectionOrderByWithRelationInput[] = [];
  switch (sort) {
    case "name_asc":
      order.push({ name: "asc" });
      break;
    case "name_desc":
      order.push({ name: "desc" });
      break;
    case "created_asc":
      order.push({ createdAt: "asc" });
      break;
    case "created_desc":
      order.push({ createdAt: "desc" });
      break;
    case "count_desc":
      order.push({ movies: { _count: "desc" } });
      break;
    case "count_asc":
      order.push({ movies: { _count: "asc" } });
      break;
    default:
      order.push({ createdAt: "desc" });
  }
  order.push({ id: "asc" });
  return order;
}

/**
 * Lädt Collections paginiert/gefiltert für /collections. Cache nur bei Default-Parametern.
 */
export async function getCollectionsForListPaginated(
  params: CollectionListParams = {}
): Promise<CollectionListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(12, params.pageSize ?? 24));
  const skip = (page - 1) * pageSize;
  const where = buildCollectionListWhere(params);
  const orderBy = buildCollectionListOrderBy(params.sort ?? "created_desc");

  const run = async () => {
    const [total, rows] = await Promise.all([
      prisma.collection.count({ where }),
      prisma.collection.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          coverUrl: true,
          accentColor: true,
          overview: true,
          _count: { select: { movies: true } },
        },
      }),
    ]);
    const items: CollectionListItem[] = rows.map((c) => ({
      id: c.id,
      name: c.name,
      coverUrl: pub(c.coverUrl),
      accentColor: c.accentColor ?? null,
      overview: c.overview ?? null,
      movieCount: c._count.movies,
    }));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, total, page, pageSize, totalPages };
  };

  if (isDefaultCollectionListParams(params) && page === 1) {
    return cacheGetOrSet(COLLECTIONS_LIST_DEFAULT_KEY, COLLECTIONS_LIST_TTL, run);
  }
  return run();
}

/**
 * Lädt Collections für die Listen-Seite (/collections). Gecacht; alle ohne Pagination.
 */
export async function getCollectionsForList(): Promise<CollectionListItem[]> {
  return cacheGetOrSet(COLLECTIONS_LIST_KEY, COLLECTIONS_LIST_TTL, async () => {
    const rows = await prisma.collection.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        coverUrl: true,
        accentColor: true,
        overview: true,
        _count: { select: { movies: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      coverUrl: pub(c.coverUrl),
      accentColor: c.accentColor ?? null,
      overview: c.overview ?? null,
      movieCount: c._count.movies,
    }));
  });
}
