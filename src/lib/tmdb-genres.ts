/**
 * TMDb-Genre-IDs auf lokale Enums (Genre, TVGenre) mappen.
 * Generischer Mapper: O(n), Set für Duplikate.
 */

import type { Genre, TVGenre } from "@/generated/prisma/enums";
import { Genre as GenreEnum, TVGenre as TVGenreEnum } from "@/generated/prisma/enums";

/** TMDb Film-Genre-IDs → Genre (DE). */
export const TMDB_GENRE_MAP: Record<number, Genre> = {
  28: GenreEnum.ACTION,
  12: GenreEnum.ABENTEUER,
  16: GenreEnum.ANIMATION,
  35: GenreEnum.KOMOEDIE,
  80: GenreEnum.KRIMI,
  99: GenreEnum.DOKU,
  18: GenreEnum.DRAMA,
  10751: GenreEnum.KIDS,
  14: GenreEnum.FANTASY,
  36: GenreEnum.DEUTSCHER_FILM,
  27: GenreEnum.HORROR,
  10402: GenreEnum.MUSIK,
  9648: GenreEnum.THRILLER,
  10749: GenreEnum.LOVESTORY,
  878: GenreEnum.SCIFI,
  10770: GenreEnum.TV_FILM,
  53: GenreEnum.THRILLER,
  10752: GenreEnum.KRIEGSFILM,
  37: GenreEnum.WESTERN,
};

/** TMDb TV-Genre-IDs → TVGenre. */
export const TMDB_TV_GENRE_MAP: Record<number, TVGenre> = {
  10759: TVGenreEnum.ACTION_ADVENTURE,
  16: TVGenreEnum.ANIMATION,
  35: TVGenreEnum.KOMOEDIE,
  80: TVGenreEnum.KRIMI,
  99: TVGenreEnum.DOKUMENTARFILM,
  18: TVGenreEnum.DRAMA,
  10751: TVGenreEnum.FAMILIE,
  10762: TVGenreEnum.KIDS,
  9648: TVGenreEnum.MYSTERY,
  10763: TVGenreEnum.NEWS,
  10764: TVGenreEnum.REALITY,
  10765: TVGenreEnum.SCIFI_FANTASY,
  10766: TVGenreEnum.SOAP,
  10767: TVGenreEnum.TALK,
  10768: TVGenreEnum.WAR_POLITICS,
  37: TVGenreEnum.WESTERN,
};

function mapTmdbToEnum<T>(
  map: Record<number, T>,
  idsOrObjs?: ReadonlyArray<number | { id: number }>
): T[] {
  if (!idsOrObjs?.length) return [];
  const ids = idsOrObjs.map((g) => (typeof g === "number" ? g : g.id));
  const seen = new Set<T>();
  const result: T[] = [];
  for (const id of ids) {
    const value = map[id];
    if (value !== undefined && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

/** TMDb Film-Genre-IDs (oder Objekte mit id) → Genre[]. */
export function mapTmdbGenresToEnum(
  idsOrObjs?: ReadonlyArray<number | { id: number }>
): Genre[] {
  return mapTmdbToEnum(TMDB_GENRE_MAP, idsOrObjs);
}

/** TMDb TV-Genre-IDs (oder Objekte mit id) → TVGenre[]. */
export function mapTmdbTVGenresToEnum(
  idsOrObjs?: ReadonlyArray<number | { id: number }>
): TVGenre[] {
  return mapTmdbToEnum(TMDB_TV_GENRE_MAP, idsOrObjs);
}
