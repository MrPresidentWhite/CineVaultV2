import { NextResponse } from "next/server";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getSeries, getSeason, tmdbImg } from "@/lib/tmdb";
import { ensureTmdbCached, toPublicUrl } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  const { tmdbId } = await context.params;
  const idNum = Number(tmdbId);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    return NextResponse.json(
      { ok: false, error: "Ungültige TMDb-ID" },
      { status: 400 }
    );
  }

  try {
    const d = await getSeries(idNum);
    if (!d) {
      return NextResponse.json(
        { ok: false, error: "Serie bei TMDb nicht gefunden" },
        { status: 404 }
      );
    }

    const [posterKey, backdropKey] = await Promise.all([
      d.poster_path
        ? ensureTmdbCached({ filePath: d.poster_path, size: "w500" })
        : Promise.resolve<string | null>(null),
      d.backdrop_path
        ? ensureTmdbCached({ filePath: d.backdrop_path, size: "w780" })
        : Promise.resolve<string | null>(null),
    ]);

    const seasonsSource =
      d.seasons?.filter(
        (s) =>
          typeof s.season_number === "number" && s.season_number >= 1
      ) ?? [];

    const seasons = await Promise.all(
      seasonsSource.map(async (s) => {
        const sn = s.season_number;
        const sd = await getSeason(d.id, sn);
        const [seasonPosterKey] = await Promise.all([
          sd.poster_path
            ? ensureTmdbCached({
                filePath: sd.poster_path,
                size: "w342",
              })
            : Promise.resolve<string | null>(null),
        ]);

        const episodes =
          sd.episodes?.map((ep) => ({
            episodeNumber: ep.episode_number,
            name: ep.name,
            runtime: ep.runtime ?? null,
            stillUrl: tmdbImg.still(ep.still_path, "w300") ?? null,
          })) ?? [];

        return {
          seasonNumber: sn,
          name: sd.name || `Staffel ${sn}`,
          overview: sd.overview || null,
          posterUrl: seasonPosterKey ? toPublicUrl(seasonPosterKey) : null,
          episodes,
        };
      })
    );

    return NextResponse.json({
      details: {
        id: d.id,
        name: d.name,
        tagline: d.tagline ?? null,
        overview: d.overview ?? null,
        first_air_date: d.first_air_date ?? null,
        last_air_date: d.last_air_date ?? null,
        posterUrl: posterKey ? toPublicUrl(posterKey) : null,
        backdropUrl: backdropKey ? toPublicUrl(backdropKey) : null,
      },
      seasons,
    });
  } catch (e) {
    console.error("Import inspectSeries error:", e);
    return NextResponse.json(
      { ok: false, error: "Fehler beim Laden der Serien-Details" },
      { status: 500 }
    );
  }
}

