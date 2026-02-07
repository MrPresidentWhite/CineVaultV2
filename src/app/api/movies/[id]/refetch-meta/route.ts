import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getMovieDetails, getMovieReleaseInfo } from "@/lib/tmdb";
import { invalidateMovieCache } from "@/lib/movie-data";
import { invalidateHomeCache } from "@/lib/home-data";

function mapDeCertificationToFsk(cert?: string | null): number | null {
  if (!cert) return null;
  const n = parseInt(cert, 10);
  if ([0, 6, 12, 16, 18].includes(n)) return n;
  return null;
}

async function getFskFromTmdbMovie(tmdbMovieId: number): Promise<number | null> {
  try {
    const rel = await getMovieReleaseInfo(tmdbMovieId);
    const de = rel.results?.find((r) => r.iso_3166_1 === "DE");
    if (!de) return null;
    const preferred =
      de.release_dates?.find((x) => x.certification?.trim()) ??
      de.release_dates?.[0];
    return mapDeCertificationToFsk(preferred?.certification);
  } catch {
    return null;
  }
}

/**
 * POST /api/movies/[id]/refetch-meta
 * Lädt Titel, Tagline, Overview und FSK (DE) von TMDb und aktualisiert den Film.
 * Erfordert EDITOR.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ ok: false, error: "Ungültige ID" }, { status: 400 });
  }

  const m = await prisma.movie.findUnique({
    where: { id: idNum },
    select: { id: true, tmdbId: true },
  });
  if (!m?.tmdbId) {
    return NextResponse.json(
      { ok: false, error: "Film hat keine TMDb-ID" },
      { status: 400 }
    );
  }

  try {
    const [d, fsk] = await Promise.all([
      getMovieDetails(m.tmdbId),
      getFskFromTmdbMovie(m.tmdbId),
    ]);
    if (!d) {
      return NextResponse.json(
        { ok: false, error: "TMDb-Details nicht gefunden" },
        { status: 404 }
      );
    }

    const fskValid =
      typeof fsk === "number" && [0, 6, 12, 16, 18].includes(fsk) ? fsk : null;

    await prisma.movie.update({
      where: { id: idNum },
      data: {
        title: d.title,
        tagline: d.tagline || null,
        overview: d.overview || null,
        fsk: fskValid,
      },
    });
    await Promise.all([invalidateMovieCache(idNum), invalidateHomeCache()]);

    return NextResponse.json({
      ok: true,
      title: d.title,
      tagline: d.tagline,
      overview: d.overview,
      fsk: fskValid,
    });
  } catch (e) {
    console.error("refetch-meta (movie) failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          "TMDb momentan nicht erreichbar – versuch es später nochmal",
      },
      { status: 503 }
    );
  }
}
