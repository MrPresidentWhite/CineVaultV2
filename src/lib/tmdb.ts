/**
 * TMDb API Client (v3) mit Redis-Caching, Retry und Rate-Limiting.
 * Nutzt TMDB_API_KEY und TMDB_IMAGE_BASE_URL aus der Umgebung.
 */

import { cacheGetOrSet } from "./cache";
import { TMDB_API_KEY, TMDB_IMAGE_BASE_URL } from "./env";

const BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_LANG = "de-DE";

type Query = Record<string, string | number | boolean | undefined>;

function getApiKey(): string {
  const key = TMDB_API_KEY;
  if (!key || key === "") {
    throw new Error("TMDb API Key fehlt (TMDB_API_KEY in .env).");
  }
  return key;
}

/** TMDb-Bild-URLs bauen (nutzt TMDB_IMAGE_BASE_URL aus .env). */
export const tmdbImg = {
  poster: (
    path?: string | null,
    size: "w185" | "w342" | "w500" | "original" = "w342"
  ) => (path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null),
  backdrop: (
    path?: string | null,
    size: "w780" | "w1280" | "original" = "w780"
  ) => (path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null),
  still: (path?: string | null, size: "w300" | "w780" | "original" = "w300") =>
    path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null,
};

/**
 * Zentraler Request mit Redis-Cache, Retry und 429-Backoff.
 */
async function request<T>(
  path: string,
  query: Query = {},
  lang = DEFAULT_LANG,
  ttlSeconds = 3600,
  retryCount = 3
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", lang);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const cacheKey = `tmdb:${lang}:${path}:${JSON.stringify(query)}`;

  return cacheGetOrSet<T>(cacheKey, ttlSeconds, async () => {
    let attempts = 0;
    while (attempts < retryCount) {
      try {
        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
        });

        if (res.status === 429) {
          const waitMs =
            Math.pow(2, attempts) * 1000 + Math.random() * 200;
          console.warn(`TMDb Rate Limit (429) – warte ${Math.round(waitMs)}ms`);
          await new Promise((r) => setTimeout(r, waitMs));
          attempts++;
          continue;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `TMDb ${path} failed: ${res.status} ${res.statusText} ${text}`
          );
        }

        return (await res.json()) as Promise<T>;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempts >= retryCount - 1) throw err;
        attempts++;
        const waitMs = Math.pow(2, attempts) * 1000;
        console.warn(`TMDb Retry ${attempts}/${retryCount} nach Fehler: ${message}`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    throw new Error(`TMDb Request failed after ${retryCount} attempts`);
  });
}

/* ====================================================================== */
/* === MOVIES =========================================================== */
/* ====================================================================== */

export async function searchMovies(q: string, page = 1) {
  return request<{
    page: number;
    results: Array<{
      id: number;
      title: string;
      release_date?: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      overview?: string | null;
      genre_ids?: number[];
    }>;
    total_pages: number;
    total_results: number;
  }>("/search/movie", { query: q, page, include_adult: false }, DEFAULT_LANG, 60);
}

export async function getMovie(id: number) {
  return request<{
    id: number;
    title: string;
    original_title: string;
    release_date?: string;
    runtime?: number;
    poster_path?: string | null;
    backdrop_path?: string | null;
    overview?: string | null;
    tagline?: string | null;
    belongs_to_collection?: null | {
      id: number;
      name: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
    };
    genres?: { id: number; name: string }[];
    credits?: unknown;
    images?: unknown;
    release_dates?: unknown;
  }>(
    `/movie/${id}`,
    { append_to_response: "credits,images,release_dates" },
    DEFAULT_LANG,
    3600
  );
}

export const getMovieDetails = getMovie;

export async function getMovieReleaseInfo(id: number) {
  return request<{
    id: number;
    results: Array<{
      iso_3166_1: string;
      release_dates: Array<{ certification: string }>;
    }>;
  }>(`/movie/${id}/release_dates`, {}, DEFAULT_LANG, 24 * 3600);
}

export async function getCollection(id: number) {
  return request<{
    id: number;
    name: string;
    overview?: string | null;
    poster_path?: string | null;
    backdrop_path?: string | null;
    parts?: Array<{
      id: number;
      title: string;
      poster_path?: string | null;
      release_date?: string;
      backdrop_path?: string | null;
      overview?: string | null;
      runtime?: number;
      tagline?: string | null;
    }>;
  }>(`/collection/${id}`, {}, DEFAULT_LANG, 3600);
}

export const getCollectionDetails = getCollection;

/* ====================================================================== */
/* === TV SHOWS ========================================================= */
/* ====================================================================== */

export async function searchSeries(q: string, page = 1) {
  return request<{
    page: number;
    results: Array<{
      id: number;
      name: string;
      first_air_date?: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      overview?: string | null;
      genre_ids?: number[];
    }>;
    total_pages: number;
    total_results: number;
  }>("/search/tv", { query: q, page, include_adult: false }, DEFAULT_LANG, 60);
}

export async function getSeries(id: number) {
  return request<{
    id: number;
    name: string;
    original_name: string;
    first_air_date?: string;
    last_air_date?: string;
    number_of_seasons?: number;
    number_of_episodes?: number;
    poster_path?: string | null;
    backdrop_path?: string | null;
    overview?: string | null;
    tagline?: string | null;
    genres?: { id: number; name: string }[];
    seasons?: Array<{
      season_number: number;
      episode_count: number;
      air_date?: string;
      name: string;
      poster_path?: string | null;
    }>;
  }>(
    `/tv/${id}`,
    { append_to_response: "credits,images" },
    DEFAULT_LANG,
    3600
  );
}

export async function getSeason(seriesId: number, seasonNumber: number) {
  return request<{
    _id: string;
    id: number;
    name: string;
    overview: string;
    air_date?: string;
    poster_path?: string | null;
    season_number: number;
    episodes: Array<{
      id: number;
      episode_number: number;
      name: string;
      overview: string;
      air_date?: string;
      still_path?: string | null;
      runtime?: number;
    }>;
  }>(`/tv/${seriesId}/season/${seasonNumber}`, {}, DEFAULT_LANG, 3600);
}

export async function getEpisode(
  seriesId: number,
  seasonNumber: number,
  episodeNumber: number
) {
  return request<{
    id: number;
    name: string;
    overview: string;
    air_date?: string;
    still_path?: string | null;
    runtime?: number;
  }>(
    `/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`,
    {},
    DEFAULT_LANG,
    3600
  );
}

export async function getTvContentRatings(tvId: number) {
  return request<{
    id: number;
    results: Array<{
      iso_3166_1: string;
      rating: string;
      descriptors?: unknown[];
    }>;
  }>(`/tv/${tvId}/content_ratings`, {}, DEFAULT_LANG, 86400);
}

/** TMDb TV-Ratings auf FSK (DE) mappen. */
export function mapTvRatingsToFskDE(
  results: Array<{ iso_3166_1: string; rating: string }>
): 0 | 6 | 12 | 16 | 18 | null {
  if (!results?.length) return null;
  const order = ["DE", "AT", "CH", "GB", "US", "AU"];
  const found = order
    .map((c) => results.find((r) => r.iso_3166_1 === c))
    .find(Boolean);
  const source = found?.rating?.trim();
  if (!source) return null;
  const n = parseInt(source.replace(/\D/g, ""), 10);
  if ([0, 6, 12, 16, 18].includes(n)) return n as 0 | 6 | 12 | 16 | 18;
  const s = source.toUpperCase();
  if (/TV-MA|MA15|18\+/.test(s)) return 18;
  if (/TV-14|14\+|M/.test(s)) return 12;
  if (/TV-PG|PG|B-15/.test(s)) return 6;
  if (/TV-G|G|U\/A|ALL/.test(s)) return 0;
  return null;
}
