import { prisma } from "@/lib/db";
import { getCollectionDetails } from "@/lib/tmdb";
import {
  ensureTmdbCached,
  getObjectAsBuffer,
  NO_POSTER_KEY,
  NO_BACKDROP_KEY,
} from "@/lib/storage";
import { getAccentFromBuffer } from "@/lib/accent";

/**
 * Findet oder legt eine Collection anhand der TMDb-Collection-ID an
 * (Name, Overview, Poster/Backdrop in R2). Wird vom Film-Import und vom
 * Script „link-movie-collections“ genutzt.
 */
export async function getOrCreateCollectionByTmdbId(
  tmdbCollectionId: number,
  onProgress?: (p: number, msg: string) => void
): Promise<number | null> {
  const existing = await prisma.collection.findUnique({
    where: { tmdbId: tmdbCollectionId },
    select: { id: true },
  });
  if (existing) return existing.id;

  onProgress?.(0, "Lade Collection-Daten (TMDb) …");
  const c = await getCollectionDetails(tmdbCollectionId);
  if (!c) return null;

  onProgress?.(20, "Lade Collection-Poster (TMDb → R2) …");
  const posterKey = c.poster_path
    ? await ensureTmdbCached({
        filePath: c.poster_path.replace(/^\//, ""),
        size: "w500",
      }).catch(() => NO_POSTER_KEY)
    : NO_POSTER_KEY;
  onProgress?.(50, "Lade Collection-Backdrop (TMDb → R2) …");
  const backdropPath = c.backdrop_path?.replace(/^\//, "") ?? null;
  const backdropKey = backdropPath
    ? await ensureTmdbCached({
        filePath: backdropPath,
        size: "w780",
      }).catch(() => NO_BACKDROP_KEY)
    : NO_BACKDROP_KEY;
  const coverKey = backdropPath
    ? await ensureTmdbCached({
        filePath: backdropPath,
        size: "w780",
      }).catch(() => NO_BACKDROP_KEY)
    : NO_BACKDROP_KEY;

  onProgress?.(80, "Berechne Akzentfarben (Collection) …");
  const [posterBuf, backdropBuf] = await Promise.all([
    posterKey && posterKey !== NO_POSTER_KEY
      ? getObjectAsBuffer(posterKey)
      : Promise.resolve(null),
    backdropKey && backdropKey !== NO_BACKDROP_KEY
      ? getObjectAsBuffer(backdropKey)
      : Promise.resolve(null),
  ]);
  const accentColor = await getAccentFromBuffer(posterBuf);
  const accentColorBackdrop = await getAccentFromBuffer(backdropBuf);

  const created = await prisma.collection.create({
    data: {
      tmdbId: tmdbCollectionId,
      name: c.name,
      overview: c.overview ?? null,
      posterUrl: posterKey !== NO_POSTER_KEY ? posterKey : null,
      backdropUrl: backdropKey !== NO_BACKDROP_KEY ? backdropKey : null,
      coverUrl: coverKey !== NO_BACKDROP_KEY ? coverKey : null,
      accentColor: accentColor ?? null,
      accentColorBackdrop: accentColorBackdrop ?? null,
    },
    select: { id: true },
  });
  return created.id;
}
