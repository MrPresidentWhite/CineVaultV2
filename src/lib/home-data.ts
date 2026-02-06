/**
 * Homepage-Daten: Pools aus Prisma + Cache, Shuffle, Public-URLs.
 * Entspricht der Logik aus dem alten home.ts.
 */

import { prisma } from "@/lib/db";
import { toPublicUrl } from "@/lib/storage";
import { cacheDelete, cacheGetOrSet } from "@/lib/cache";
import { shuffleTake } from "@/lib/shuffle";

const HOME_POOLS_CACHE_KEY = "home:pools:v1";

/** TTL für die Roh-Pools (Filme/Collections/Serien). Shuffle passiert bei jeder Anfrage. */
const HOME_POOLS_TTL = 300;
const HOME_MOVIES_TAKE = 8;
const HOME_COLLECTIONS_TAKE = 5;
const HOME_SERIES_TAKE = 8;

export type HomeMovie = {
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

export type HomeCollection = {
  id: number;
  name: string;
  coverUrl: string | null;
  accentColor: string | null;
  overview: string | null;
  movieCount: number;
};

export type HomeSeries = {
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

export type HomeData = {
  collections: HomeCollection[];
  standalone: HomeMovie[];
  series: HomeSeries[];
};

const pub = (u: string | null | undefined) => toPublicUrl(u) ?? null;

/**
 * Lädt Home-Daten (Collections, Filme, Serien). Nur die Roh-Pools werden gecacht;
 * Shuffle läuft bei jeder Anfrage, damit die Reihenfolge wirklich zufällig ist.
 */
export async function getHomeData(): Promise<HomeData> {
  const { moviesPool, collectionsPool, seriesRaw } = await cacheGetOrSet(
    HOME_POOLS_CACHE_KEY,
    HOME_POOLS_TTL,
    async () => {
      const [moviesPool, collectionsPool, seriesRaw] = await Promise.all([
        prisma.movie.findMany({
          orderBy: { addedAt: "desc" },
          take: 200,
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
            addedAt: true,
            collectionId: true,
            status: true,
          },
        }),
        prisma.collection.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            name: true,
            coverUrl: true,
            accentColor: true,
            overview: true,
            _count: { select: { movies: true } },
          },
        }),
        prisma.series.findMany({
          orderBy: { createdAt: "desc" },
          take: HOME_SERIES_TAKE,
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
      return { moviesPool, collectionsPool, seriesRaw };
    }
  );

  const shuffledMovies = shuffleTake(moviesPool, HOME_MOVIES_TAKE);
  const shuffledCollections = shuffleTake(
    collectionsPool,
    HOME_COLLECTIONS_TAKE
  );

  const standalone: HomeMovie[] = shuffledMovies.map((m) => ({
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

  const collections: HomeCollection[] = shuffledCollections.map((c) => ({
    id: c.id,
    name: c.name,
    coverUrl: pub(c.coverUrl),
    accentColor: c.accentColor ?? null,
    overview: c.overview ?? null,
    movieCount: c._count.movies,
  }));

  const series: HomeSeries[] = seriesRaw.map((s) => ({
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

  return { collections, standalone, series };
}

/**
 * Invalidiert den Home-Pools-Cache (z. B. nach Änderung an Filmen/Collections/Serien).
 * Nächster Aufruf von getHomeData() lädt frisch aus der DB.
 */
export async function invalidateHomeCache(): Promise<void> {
  await cacheDelete(HOME_POOLS_CACHE_KEY);
}
