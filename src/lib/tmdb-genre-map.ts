/**
 * TMDb-Genre-Namen (de-DE) auf lokales Genre-Enum mappen.
 * Wird genutzt, wenn TMDb genre-Namen statt IDs zurückgibt.
 */

import type { Genre } from "@/generated/prisma/enums";
import { Genre as GenreEnum } from "@/generated/prisma/enums";

const mapDe: Record<string, Genre> = {
  Drama: GenreEnum.DRAMA,
  Komödie: GenreEnum.KOMOEDIE,
  Thriller: GenreEnum.THRILLER,
  Krimi: GenreEnum.KRIMI,
  Horror: GenreEnum.HORROR,
  Action: GenreEnum.ACTION,
  Dokumentarfilm: GenreEnum.DOKU,
  Dokumentation: GenreEnum.DOKU,
  Liebesfilm: GenreEnum.LOVESTORY,
  Abenteuer: GenreEnum.ABENTEUER,
  Fantasy: GenreEnum.FANTASY,
  Familie: GenreEnum.KIDS,
  Animation: GenreEnum.ANIMATION,
  "Science Fiction": GenreEnum.SCIFI,
  "TV-Film": GenreEnum.TV_FILM,
  Kriegsfilm: GenreEnum.KRIEGSFILM,
  Musik: GenreEnum.MUSIK,
  Western: GenreEnum.WESTERN,
  Kinderfilm: GenreEnum.KIDS,
  Historie: GenreEnum.DOKU,
};

/**
 * Mappt TMDb-Genre-Objekte (id + name) auf lokale Genre-Enum-Werte.
 * Erhält Reihenfolge, keine Duplikate.
 */
export function mapTmdbGenresToLocal(
  tmdbNames?: { id: number; name: string }[]
): Genre[] {
  if (!tmdbNames?.length) return [];
  const out: Genre[] = [];
  const seen = new Set<Genre>();
  for (const g of tmdbNames) {
    const local = mapDe[g.name];
    if (local && !seen.has(local)) {
      seen.add(local);
      out.push(local);
    }
  }
  return out;
}
