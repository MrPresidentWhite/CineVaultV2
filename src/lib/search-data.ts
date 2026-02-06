/**
 * Such-Vorschläge (Filme, Collections, Serien).
 * Entspricht der Logik aus dem alten search.ts: Varianten, Caps, Dedupe, Cache.
 */

import { prisma } from "@/lib/db";
import { toPublicUrl } from "@/lib/storage";
import { cacheGetOrSet } from "@/lib/cache";

const SEARCH_SUGGEST_TTL_MIN = 25;
const SEARCH_SUGGEST_TTL_JITTER = 12;
const SEARCH_CACHE_KEY_PREFIX = "search:suggest:v1:";
const QUERY_MODE = "insensitive" as const;

export function normalizeSearchQuery(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Such-Varianten für startsWith/contains (z. B. "&" → "und", "-" → " "). */
export function expandSearchVariants(raw: string): string[] {
  const q = normalizeSearchQuery(raw);
  const out = new Set<string>([q]);
  if (q.includes("&")) {
    out.add(q.replace(/&/g, "und"));
    out.add(q.replace(/&/g, "and"));
    out.add(q.replace(/\s*&\s*/g, " "));
  }
  if (q.includes("-")) out.add(q.replace(/-/g, " "));
  if (q.includes(" ")) out.add(q.replace(/\s+/g, "-"));
  return Array.from(out).slice(0, 6);
}

function dedupeById<T extends { id: number | string }>(arr: T[]): T[] {
  const seen = new Set<number | string>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x.id)) {
      seen.add(x.id);
      out.push(x);
    }
  }
  return out;
}

/** Dynamische Caps je Kategorie (Trefferanzahl + Query-Spezifität). */
function deriveCaps(spec: {
  q: string;
  mPrefix: number;
  cPrefix: number;
  sPrefix: number;
}) {
  const q = normalizeSearchQuery(spec.q);
  const len = q.length;
  const hasYear = /\b(19|20)\d{2}\b/.test(q);
  const hasSymbol = /[&\-]/.test(q);
  const baseM = 6,
    baseC = 4,
    baseS = 4;
  const scale = (count: number, base: number, hardMax: number) => {
    let cap =
      count >= 40
        ? Math.max(base + 10, 16)
        : count >= 20
          ? Math.max(base + 6, 12)
          : count >= 10
            ? Math.max(base + 3, 9)
            : base;
    if (len >= 6) cap += 2;
    if (hasYear) cap += 2;
    if (hasSymbol) cap += 1;
    return Math.min(Math.max(cap, base), hardMax);
  };
  return {
    MOVIE_CAP: scale(spec.mPrefix, baseM, 30),
    COLLECTION_CAP: scale(spec.cPrefix, baseC, 20),
    SERIES_CAP: scale(spec.sPrefix, baseS, 20),
  };
}

export type SearchSuggestMovie = {
  id: number;
  title: string;
  year: number | null;
  poster: string | null;
  href: string;
};

export type SearchSuggestCollection = {
  id: number;
  name: string;
  poster: string | null;
  href: string;
};

export type SearchSuggestSeries = {
  id: number;
  title: string;
  poster: string | null;
  href: string;
};

export type SearchSuggestResult = {
  movies: SearchSuggestMovie[];
  collections: SearchSuggestCollection[];
  series: SearchSuggestSeries[];
};

const pub = (u: string | null | undefined) => toPublicUrl(u) ?? null;

/**
 * Lädt Such-Vorschläge für Filme, Collections, Serien. Gecacht (TTL mit Jitter).
 */
export async function getSearchSuggestions(q: string): Promise<SearchSuggestResult> {
  const trimmed = q.trim();
  if (!trimmed) {
    return { movies: [], collections: [], series: [] };
  }

  const normalized = normalizeSearchQuery(trimmed);
  const variants = expandSearchVariants(trimmed);
  const cacheKey = `${SEARCH_CACHE_KEY_PREFIX}${normalized}`;
  const ttl = SEARCH_SUGGEST_TTL_MIN + Math.floor(Math.random() * (SEARCH_SUGGEST_TTL_JITTER + 1));

  return cacheGetOrSet(cacheKey, ttl, async () => {
    const [mPrefixCount, cPrefixCount, sPrefixCount] = await Promise.all([
      prisma.movie.count({
        where: {
          OR: variants.map((v) => ({ title: { startsWith: v, mode: QUERY_MODE } })),
        },
      }),
      prisma.collection.count({
        where: {
          OR: variants.map((v) => ({ name: { startsWith: v, mode: QUERY_MODE } })),
        },
      }),
      prisma.series.count({
        where: {
          OR: variants.map((v) => ({ title: { startsWith: v, mode: QUERY_MODE } })),
        },
      }),
    ]);

    const { MOVIE_CAP, COLLECTION_CAP, SERIES_CAP } = deriveCaps({
      q: trimmed,
      mPrefix: mPrefixCount,
      cPrefix: cPrefixCount,
      sPrefix: sPrefixCount,
    });

    const [mExact, cExact, sExact] = await Promise.all([
      prisma.movie.findMany({
        where: { title: { equals: trimmed, mode: QUERY_MODE } },
        select: { id: true, title: true, releaseYear: true, posterUrl: true },
        take: 3,
      }),
      prisma.collection.findMany({
        where: { name: { equals: trimmed, mode: QUERY_MODE } },
        select: { id: true, name: true, posterUrl: true, coverUrl: true },
        take: 3,
      }),
      prisma.series.findMany({
        where: { title: { equals: trimmed, mode: QUERY_MODE } },
        select: { id: true, title: true, posterUrl: true },
        take: 3,
      }),
    ]);

    const movieWherePrefix = {
      OR: variants.map((v) => ({ title: { startsWith: v, mode: QUERY_MODE } })),
    };
    const collectionWherePrefix = {
      OR: variants.map((v) => ({ name: { startsWith: v, mode: QUERY_MODE } })),
    };
    const seriesWherePrefix = {
      OR: variants.map((v) => ({ title: { startsWith: v, mode: QUERY_MODE } })),
    };

    const [mPrefix, cPrefix, sPrefix] = await Promise.all([
      prisma.movie.findMany({
        where: movieWherePrefix,
        select: { id: true, title: true, releaseYear: true, posterUrl: true },
        orderBy: [{ title: "asc" }, { id: "asc" }],
        take: MOVIE_CAP * 2,
      }),
      prisma.collection.findMany({
        where: collectionWherePrefix,
        select: { id: true, name: true, posterUrl: true, coverUrl: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: COLLECTION_CAP * 2,
      }),
      prisma.series.findMany({
        where: seriesWherePrefix,
        select: { id: true, title: true, posterUrl: true },
        orderBy: [{ title: "asc" }, { id: "asc" }],
        take: SERIES_CAP * 2,
      }),
    ]);

    const mSeen = dedupeById([...mExact, ...mPrefix]).map((x) => x.id);
    const cSeen = dedupeById([...cExact, ...cPrefix]).map((x) => x.id);
    const sSeen = dedupeById([...sExact, ...sPrefix]).map((x) => x.id);
    const mNeed = Math.max(MOVIE_CAP - mSeen.length, 0);
    const cNeed = Math.max(COLLECTION_CAP - cSeen.length, 0);
    const sNeed = Math.max(SERIES_CAP - sSeen.length, 0);

    const movieWhereContains = {
      AND: [
        {
          OR: variants.map((v) => ({ title: { contains: v, mode: QUERY_MODE } })),
        },
        { id: { notIn: mSeen } },
      ],
    };
    const collectionWhereContains = {
      AND: [
        {
          OR: variants.map((v) => ({ name: { contains: v, mode: QUERY_MODE } })),
        },
        { id: { notIn: cSeen } },
      ],
    };
    const seriesWhereContains = {
      AND: [
        {
          OR: variants.map((v) => ({ title: { contains: v, mode: QUERY_MODE } })),
        },
        { id: { notIn: sSeen } },
      ],
    };

    const [mContains, cContains, sContains] = await Promise.all([
      mNeed
        ? prisma.movie.findMany({
            where: movieWhereContains,
            select: { id: true, title: true, releaseYear: true, posterUrl: true },
            orderBy: [{ releaseYear: "desc" }, { id: "desc" }],
            take: mNeed * 2,
          })
        : [],
      cNeed
        ? prisma.collection.findMany({
            where: collectionWhereContains,
            select: { id: true, name: true, posterUrl: true, coverUrl: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            take: cNeed * 2,
          })
        : [],
      sNeed
        ? prisma.series.findMany({
            where: seriesWhereContains,
            select: { id: true, title: true, posterUrl: true },
            orderBy: [{ title: "asc" }, { id: "asc" }],
            take: sNeed * 2,
          })
        : [],
    ]);

    const mMerged = dedupeById([...mExact, ...mPrefix, ...mContains]).slice(0, MOVIE_CAP);
    const cMerged = dedupeById([...cExact, ...cPrefix, ...cContains]).slice(0, COLLECTION_CAP);
    const sMerged = dedupeById([...sExact, ...sPrefix, ...sContains]).slice(0, SERIES_CAP);

    return {
      movies: mMerged.map((m) => ({
        id: m.id,
        title: m.title,
        year: m.releaseYear ?? null,
        poster: pub(m.posterUrl),
        href: `/movies/${m.id}`,
      })),
      collections: cMerged.map((c) => ({
        id: c.id,
        name: c.name,
        poster: pub(c.coverUrl ?? c.posterUrl),
        href: `/collections/${c.id}`,
      })),
      series: sMerged.map((s) => ({
        id: s.id,
        title: s.title,
        poster: pub(s.posterUrl),
        href: `/series/${s.id}`,
      })),
    };
  });
}
