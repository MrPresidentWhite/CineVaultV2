import { NextResponse } from "next/server";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  getMovie,
  getFskFromMovieReleaseDates,
  getSeries,
  getTvContentRatings,
  mapTvRatingsToFskDE,
  getMovieDetails,
  getCollectionDetails,
} from "@/lib/tmdb";
import {
  ensureTmdbCached,
  getObjectAsBuffer,
  tmdbKey,
  NO_POSTER_KEY,
  NO_BACKDROP_KEY,
} from "@/lib/storage";
import { getAccentFromBuffer } from "@/lib/accent";
import { invalidateMovieCache, invalidateMoviesListCache } from "@/lib/movie-data";
import { invalidateSeriesCache, invalidateSeriesListCache } from "@/lib/series-data";
import {
  invalidateCollectionCache,
  invalidateCollectionsListCache,
} from "@/lib/collection-data";
import { invalidateHomeCache } from "@/lib/home-data";

const BATCH_LIMIT_MAX = 10;
const BATCH_LIMIT_DEFAULT = 5;

export type BulkRefetchLogEntry = {
  type: "movie" | "series" | "collection";
  id: number;
  name: string;
  result: "updated" | "skipped" | "error";
  message?: string;
};

/**
 * POST /api/admin/bulk-refetch/run
 * Führt einen Batch Refetch (Meta + Images) aus. type = movies | series | collections, offset, limit.
 * Erfordert ADMIN.
 */
export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  let body: { type?: string; offset?: number; limit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Body" },
      { status: 400 }
    );
  }

  const type = body.type === "series" || body.type === "collections"
    ? body.type
    : body.type === "movies"
      ? "movies"
      : null;
  if (!type) {
    return NextResponse.json(
      { error: "type muss movies, series oder collections sein" },
      { status: 400 }
    );
  }

  const offset = Math.max(0, Number(body.offset) ?? 0);
  const limit = Math.min(
    BATCH_LIMIT_MAX,
    Math.max(1, Number(body.limit) ?? BATCH_LIMIT_DEFAULT)
  );

  const log: BulkRefetchLogEntry[] = [];
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    if (type === "movies") {
      const movies = await prisma.movie.findMany({
        where: { tmdbId: { not: null } },
        select: {
          id: true,
          title: true,
          tmdbId: true,
          tagline: true,
          overview: true,
          fsk: true,
          posterUrl: true,
          backdropUrl: true,
        },
        orderBy: { id: "asc" },
        skip: offset,
        take: limit,
      });

      for (const m of movies) {
        const tmdbId = m.tmdbId!;
        try {
          const d = await getMovie(tmdbId);
          if (!d) {
            log.push({
              type: "movie",
              id: m.id,
              name: m.title,
              result: "skipped",
              message: "TMDb-Details nicht gefunden",
            });
            skipped++;
            continue;
          }

          const fskRaw = getFskFromMovieReleaseDates(d.release_dates);
          const fskValid =
            typeof fskRaw === "number" && [0, 6, 12, 16, 18].includes(fskRaw)
              ? fskRaw
              : null;

          const expectedPosterKey = d.poster_path
            ? tmdbKey(d.poster_path.replace(/^\//, ""), "w500")
            : NO_POSTER_KEY;
          const expectedBackdropKey = d.backdrop_path
            ? tmdbKey(d.backdrop_path.replace(/^\//, ""), "original")
            : NO_BACKDROP_KEY;

          const metaUnchanged =
            m.title === d.title &&
            (m.tagline ?? null) === (d.tagline ?? null) &&
            (m.overview ?? null) === (d.overview ?? null) &&
            (m.fsk ?? null) === fskValid &&
            (m.posterUrl ?? null) === expectedPosterKey &&
            (m.backdropUrl ?? null) === expectedBackdropKey;

          if (metaUnchanged) {
            log.push({
              type: "movie",
              id: m.id,
              name: m.title,
              result: "skipped",
              message: "Unverändert (Meta & Bilder gleich)",
            });
            skipped++;
            continue;
          }

          await prisma.movie.update({
            where: { id: m.id },
            data: {
              title: d.title,
              tagline: d.tagline ?? null,
              overview: d.overview ?? null,
              fsk: fskValid,
            },
          });

          const posterKey = d.poster_path
            ? await ensureTmdbCached({
                filePath: d.poster_path.replace(/^\//, ""),
                size: "w500",
                forceRefetch: true,
              }).catch(() => NO_POSTER_KEY)
            : NO_POSTER_KEY;
          const backdropKey = d.backdrop_path
            ? await ensureTmdbCached({
                filePath: d.backdrop_path.replace(/^\//, ""),
                size: "original",
                forceRefetch: true,
              }).catch(() => NO_BACKDROP_KEY)
            : NO_BACKDROP_KEY;

          const [posterBuf, backdropBuf] = await Promise.all([
            posterKey ? getObjectAsBuffer(posterKey) : Promise.resolve(null),
            backdropKey ? getObjectAsBuffer(backdropKey) : Promise.resolve(null),
          ]);
          const accentColor = await getAccentFromBuffer(posterBuf);
          const accentColorBackdrop = backdropKey
            ? await getAccentFromBuffer(backdropBuf)
            : null;

          await prisma.movie.update({
            where: { id: m.id },
            data: {
              posterUrl: posterKey,
              backdropUrl: backdropKey,
              accentColor,
              accentColorBackdrop,
            },
          });

          await Promise.all([
            invalidateMovieCache(m.id),
            invalidateHomeCache(),
          ]);

          log.push({ type: "movie", id: m.id, name: m.title, result: "updated" });
          updated++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          log.push({
            type: "movie",
            id: m.id,
            name: m.title,
            result: "error",
            message: msg.slice(0, 200),
          });
          errors++;
        }
      }

      if (movies.length > 0) {
        await invalidateMoviesListCache();
      }
    } else if (type === "series") {
      const seriesList = await prisma.series.findMany({
        where: { tmdbId: { not: null } },
        select: {
          id: true,
          title: true,
          tmdbId: true,
          originalTitle: true,
          firstAirYear: true,
          overview: true,
          tagline: true,
          statusText: true,
          inProduction: true,
          fsk: true,
          posterUrl: true,
          backdropUrl: true,
        },
        orderBy: { id: "asc" },
        skip: offset,
        take: limit,
      });

      for (const s of seriesList) {
        const tmdbId = s.tmdbId!;
        try {
          const [d, contentRatings] = await Promise.all([
            getSeries(tmdbId),
            getTvContentRatings(tmdbId),
          ]);
          if (!d) {
            log.push({
              type: "series",
              id: s.id,
              name: s.title,
              result: "skipped",
              message: "TMDb-Details nicht gefunden",
            });
            skipped++;
            continue;
          }

          const fskRaw = contentRatings?.results
            ? mapTvRatingsToFskDE(contentRatings.results)
            : null;
          const fsk =
            typeof fskRaw === "number" && [0, 6, 12, 16, 18].includes(fskRaw)
              ? fskRaw
              : null;

          const firstAirYear = d.first_air_date
            ? new Date(d.first_air_date).getFullYear()
            : null;
          const statusText = d.last_air_date
            ? `Letzte Ausstrahlung: ${d.last_air_date}`
            : null;
          const inProduction =
            typeof d.number_of_seasons === "number" ? d.number_of_seasons > 0 : null;

          const expectedPosterKey = d.poster_path
            ? tmdbKey(d.poster_path.replace(/^\//, ""), "w500")
            : NO_POSTER_KEY;
          const expectedBackdropKey = d.backdrop_path
            ? tmdbKey(d.backdrop_path.replace(/^\//, ""), "original")
            : NO_BACKDROP_KEY;

          const metaUnchanged =
            s.title === d.name &&
            (s.originalTitle ?? null) === (d.original_name ?? null) &&
            (s.firstAirYear ?? null) === firstAirYear &&
            (s.overview ?? null) === (d.overview ?? null) &&
            (s.tagline ?? null) === (d.tagline ?? null) &&
            (s.statusText ?? null) === statusText &&
            (s.inProduction ?? null) === inProduction &&
            (s.fsk ?? null) === fsk &&
            (s.posterUrl ?? null) === expectedPosterKey &&
            (s.backdropUrl ?? null) === expectedBackdropKey;

          if (metaUnchanged) {
            log.push({
              type: "series",
              id: s.id,
              name: s.title,
              result: "skipped",
              message: "Unverändert (Meta & Bilder gleich)",
            });
            skipped++;
            continue;
          }

          const posterKey = d.poster_path
            ? await ensureTmdbCached({
                filePath: d.poster_path.replace(/^\//, ""),
                size: "w500",
                forceRefetch: true,
              }).catch(() => NO_POSTER_KEY)
            : NO_POSTER_KEY;
          const backdropKey = d.backdrop_path
            ? await ensureTmdbCached({
                filePath: d.backdrop_path.replace(/^\//, ""),
                size: "original",
                forceRefetch: true,
              }).catch(() => NO_BACKDROP_KEY)
            : NO_BACKDROP_KEY;

          const [posterBuf, backdropBuf] = await Promise.all([
            posterKey ? getObjectAsBuffer(posterKey) : Promise.resolve(null),
            backdropKey ? getObjectAsBuffer(backdropKey) : Promise.resolve(null),
          ]);
          const accentColor = await getAccentFromBuffer(posterBuf);
          const accentColorBackdrop = backdropKey
            ? await getAccentFromBuffer(backdropBuf)
            : null;

          await prisma.series.update({
            where: { id: s.id },
            data: {
              title: d.name,
              originalTitle: d.original_name ?? null,
              firstAirYear,
              overview: d.overview ?? null,
              tagline: d.tagline ?? null,
              statusText,
              inProduction: inProduction ?? undefined,
              fsk,
              posterUrl: posterKey,
              backdropUrl: backdropKey,
              accentColor,
              accentColorBackdrop,
            },
          });

          await Promise.all([
            invalidateSeriesCache(s.id),
            invalidateSeriesListCache(),
            invalidateHomeCache(),
          ]);

          log.push({ type: "series", id: s.id, name: s.title, result: "updated" });
          updated++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          log.push({
            type: "series",
            id: s.id,
            name: s.title,
            result: "error",
            message: msg.slice(0, 200),
          });
          errors++;
        }
      }
    } else {
      const collections = await prisma.collection.findMany({
        where: {
          OR: [
            { tmdbId: { not: null } },
            { movies: { some: { tmdbId: { not: null } } } },
          ],
        },
        select: {
          id: true,
          name: true,
          overview: true,
          posterUrl: true,
          backdropUrl: true,
          coverUrl: true,
          tmdbId: true,
          movies: {
            select: { tmdbId: true },
            take: 1,
            orderBy: { id: "asc" },
          },
        },
        orderBy: { id: "asc" },
        skip: offset,
        take: limit,
      });

      for (const col of collections) {
        let tmdbCollectionId: number | null = col.tmdbId ?? null;
        if (tmdbCollectionId == null && col.movies.length && col.movies[0].tmdbId) {
          const firstMovie = await getMovieDetails(col.movies[0].tmdbId!);
          tmdbCollectionId = firstMovie?.belongs_to_collection?.id ?? null;
          if (tmdbCollectionId != null) {
            await prisma.collection.update({
              where: { id: col.id },
              data: { tmdbId: tmdbCollectionId },
            });
          }
        }

        if (!tmdbCollectionId) {
          log.push({
            type: "collection",
            id: col.id,
            name: col.name,
            result: "skipped",
            message: "TMDb-Collection-ID nicht ermittelbar (weder an Collection noch über Film)",
          });
          skipped++;
          continue;
        }

        try {

          const c = await getCollectionDetails(tmdbCollectionId);
          if (!c) {
            log.push({
              type: "collection",
              id: col.id,
              name: col.name,
              result: "skipped",
              message: "TMDb-Collection nicht gefunden",
            });
            skipped++;
            continue;
          }

          const expectedPosterKey = c.poster_path
            ? tmdbKey(c.poster_path.replace(/^\//, ""), "w500")
            : NO_POSTER_KEY;
          const expectedBackdropKey = c.backdrop_path
            ? tmdbKey(c.backdrop_path.replace(/^\//, ""), "original")
            : NO_BACKDROP_KEY;
          const expectedCoverKey = c.backdrop_path
            ? tmdbKey(c.backdrop_path.replace(/^\//, ""), "w780")
            : NO_BACKDROP_KEY;

          const metaUnchanged =
            col.name === c.name &&
            (col.overview ?? null) === (c.overview ?? null) &&
            (col.posterUrl ?? null) === expectedPosterKey &&
            (col.backdropUrl ?? null) === expectedBackdropKey &&
            (col.coverUrl ?? null) === expectedCoverKey;

          if (metaUnchanged) {
            log.push({
              type: "collection",
              id: col.id,
              name: col.name,
              result: "skipped",
              message: "Unverändert (Meta & Bilder gleich)",
            });
            skipped++;
            continue;
          }

          await prisma.collection.update({
            where: { id: col.id },
            data: { name: c.name, overview: c.overview ?? null },
          });

          const posterKey = c.poster_path
            ? await ensureTmdbCached({
                filePath: c.poster_path.replace(/^\//, ""),
                size: "w500",
                forceRefetch: true,
              }).catch(() => NO_POSTER_KEY)
            : NO_POSTER_KEY;
          const backdropKey = c.backdrop_path
            ? await ensureTmdbCached({
                filePath: c.backdrop_path.replace(/^\//, ""),
                size: "original",
                forceRefetch: true,
              }).catch(() => NO_BACKDROP_KEY)
            : NO_BACKDROP_KEY;
          const coverKey = c.backdrop_path
            ? await ensureTmdbCached({
                filePath: c.backdrop_path.replace(/^\//, ""),
                size: "w780",
                forceRefetch: true,
              }).catch(() => NO_BACKDROP_KEY)
            : NO_BACKDROP_KEY;

          await prisma.collection.update({
            where: { id: col.id },
            data: {
              posterUrl: posterKey,
              backdropUrl: backdropKey,
              coverUrl: coverKey,
            },
          });

          await Promise.all([
            invalidateCollectionCache(col.id),
            invalidateCollectionsListCache(),
            invalidateHomeCache(),
          ]);

          log.push({
            type: "collection",
            id: col.id,
            name: col.name,
            result: "updated",
          });
          updated++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          log.push({
            type: "collection",
            id: col.id,
            name: col.name,
            result: "error",
            message: msg.slice(0, 200),
          });
          errors++;
        }
      }
    }

    const processed = log.length;
    const done = processed < limit;

    return NextResponse.json({
      done,
      processed,
      updated,
      skipped,
      errors,
      log,
    });
  } catch (e) {
    console.error("[bulk-refetch] run failed:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Bulk Refetch fehlgeschlagen",
      },
      { status: 500 }
    );
  }
}
