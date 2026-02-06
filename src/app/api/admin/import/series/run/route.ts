import { NextResponse } from "next/server";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import {
  Role as RoleEnum,
  Status as StatusEnum,
  Priority as PriorityEnum,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  getSeries,
  getSeason,
  getEpisode,
  getTvContentRatings,
  mapTvRatingsToFskDE,
} from "@/lib/tmdb";
import { ensureTmdbCached, toPublicUrl } from "@/lib/storage";
import { getAccentFromImage } from "@/lib/accent";
import { mapTmdbTVGenresToEnum } from "@/lib/tmdb-genres";

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  let body: {
    tmdbId?: number;
    seasons?: Array<{
      seasonNumber: number;
      episodes: "ALL" | number[];
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Request-Body" },
      { status: 400 }
    );
  }

  const tmdbId = Number(body.tmdbId);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0 || !Array.isArray(body.seasons)) {
    return NextResponse.json(
      { ok: false, error: "Ungültige Daten" },
      { status: 400 }
    );
  }

  try {
    const sd = await getSeries(tmdbId);
    if (!sd) {
      return NextResponse.json(
        { ok: false, error: "Serie bei TMDb nicht gefunden" },
        { status: 404 }
      );
    }

    const [posterKey, backdropKey] = await Promise.all([
      sd.poster_path
        ? ensureTmdbCached({ filePath: sd.poster_path, size: "w500" })
        : Promise.resolve<string | null>(null),
      sd.backdrop_path
        ? ensureTmdbCached({ filePath: sd.backdrop_path, size: "w780" })
        : Promise.resolve<string | null>(null),
    ]);

    const accentSeries = posterKey
      ? await getAccentFromImage(toPublicUrl(posterKey))
      : null;
    const accentSeriesBackdrop = backdropKey
      ? await getAccentFromImage(toPublicUrl(backdropKey))
      : null;

    const enumGenres = mapTmdbTVGenresToEnum(sd.genres || []);
    const firstYear = sd.first_air_date
      ? new Date(sd.first_air_date).getFullYear()
      : null;

    // FSK via Content Ratings
    const contentRatings = await getTvContentRatings(sd.id);
    const fskRaw = contentRatings?.results
      ? mapTvRatingsToFskDE(contentRatings.results)
      : null;
    const fsk =
      typeof fskRaw === "number" && [0, 6, 12, 16, 18].includes(fskRaw)
        ? fskRaw
        : null;

    const series = await prisma.series.upsert({
      where: { tmdbId: sd.id },
      update: {
        title: sd.name,
        fsk: fsk ?? undefined,
        originalTitle: sd.original_name ?? undefined,
        firstAirYear: firstYear ?? undefined,
        inProduction:
          typeof sd.number_of_seasons === "number"
            ? sd.number_of_seasons > 0
            : undefined,
        statusText: sd.last_air_date
          ? `Letzte Ausstrahlung: ${sd.last_air_date}`
          : undefined,
        posterUrl: posterKey ?? undefined,
        backdropUrl: backdropKey ?? undefined,
        accentColor: accentSeries ?? undefined,
        accentColorBackdrop: accentSeriesBackdrop ?? undefined,
        overview: sd.overview ?? undefined,
        tagline: sd.tagline ?? undefined,
        status: StatusEnum.ON_WATCHLIST,
        priority: PriorityEnum.STANDARD,
        assignedToUser: { connect: { id: auth.user.id } },
        genres: enumGenres.length
          ? {
              deleteMany: {},
              create: enumGenres.map((g) => ({ genre: g })),
            }
          : { deleteMany: {} },
      },
      create: {
        fsk,
        title: sd.name,
        originalTitle: sd.original_name ?? null,
        firstAirYear: firstYear,
        inProduction:
          typeof sd.number_of_seasons === "number"
            ? sd.number_of_seasons > 0
            : null,
        statusText: sd.last_air_date
          ? `Letzte Ausstrahlung: ${sd.last_air_date}`
          : null,
        posterUrl: posterKey ?? null,
        backdropUrl: backdropKey ?? null,
        accentColor: accentSeries,
        accentColorBackdrop: accentSeriesBackdrop,
        tmdbId: sd.id,
        homepage: null,
        overview: sd.overview ?? null,
        tagline: sd.tagline ?? null,
        status: StatusEnum.ON_WATCHLIST,
        priority: PriorityEnum.STANDARD,
        assignedToUser: { connect: { id: auth.user.id } },
        genres: enumGenres.length
          ? {
              create: enumGenres.map((g) => ({ genre: g })),
            }
          : {},
      },
      select: { id: true },
    });

    // Seasons + Episodes
    for (const sel of body.seasons) {
      const seasonNumber = Number(sel.seasonNumber);
      if (!Number.isFinite(seasonNumber) || seasonNumber < 1) continue;

      const sdSeason = await getSeason(sd.id, seasonNumber);
      if (!sdSeason) continue;

      const seasonPosterKey = sdSeason.poster_path
        ? await ensureTmdbCached({
            filePath: sdSeason.poster_path,
            size: "w342",
          })
        : null;
      const seasonAccent = seasonPosterKey
        ? await getAccentFromImage(toPublicUrl(seasonPosterKey))
        : null;

      const season = await prisma.season.upsert({
        where: { tmdbSeasonId: sdSeason.id ?? -1 },
        update: {
          seriesId: series.id,
          seasonNumber,
          name: sdSeason.name || `Staffel ${seasonNumber}`,
          overview: sdSeason.overview ?? undefined,
          posterUrl: seasonPosterKey ?? undefined,
          accentColor: seasonAccent ?? undefined,
          airDate: sdSeason.air_date ? new Date(sdSeason.air_date) : undefined,
        },
        create: {
          seriesId: series.id,
          seasonNumber,
          name: sdSeason.name || `Staffel ${seasonNumber}`,
          overview: sdSeason.overview ?? null,
          posterUrl: seasonPosterKey ?? null,
          accentColor: seasonAccent,
          airDate: sdSeason.air_date ? new Date(sdSeason.air_date) : null,
          tmdbSeasonId: sdSeason.id ?? null,
        },
        select: { id: true },
      });

      // Episoden
      let episodeNumbers: number[];
      if (sel.episodes === "ALL") {
        episodeNumbers =
          sdSeason.episodes?.map((e) => e.episode_number).filter(Number.isFinite) ??
          [];
      } else {
        episodeNumbers = sel.episodes.filter((n) =>
          Number.isFinite(n)
        ) as number[];
      }

      for (const epNo of episodeNumbers) {
        const ep = await getEpisode(sd.id, seasonNumber, epNo);
        if (!ep) continue;

        const stillKey = ep.still_path
          ? await ensureTmdbCached({
              filePath: ep.still_path,
              size: "w300",
            })
          : null;
        const epAccent = stillKey
          ? await getAccentFromImage(toPublicUrl(stillKey))
          : null;

        await prisma.episode.upsert({
          where: { tmdbEpisodeId: ep.id },
          update: {
            seriesId: series.id,
            seasonId: season.id,
            seasonNumber,
            episodeNumber: epNo,
            title: ep.name || `Episode ${epNo}`,
            overview: ep.overview || undefined,
            runtimeMin: ep.runtime ?? undefined,
            airDate: ep.air_date ? new Date(ep.air_date) : undefined,
            stillUrl: stillKey ?? undefined,
            accentColor: epAccent ?? undefined,
          },
          create: {
            seriesId: series.id,
            seasonId: season.id,
            seasonNumber,
            episodeNumber: epNo,
            title: ep.name || `Episode ${epNo}`,
            overview: ep.overview || null,
            runtimeMin: ep.runtime ?? null,
            airDate: ep.air_date ? new Date(ep.air_date) : null,
            stillUrl: stillKey ?? null,
            accentColor: epAccent,
            tmdbEpisodeId: ep.id,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, seriesId: series.id });
  } catch (e) {
    console.error("Import series/run error:", e);
    return NextResponse.json(
      { ok: false, error: "Serien-Import fehlgeschlagen" },
      { status: 500 }
    );
  }
}

