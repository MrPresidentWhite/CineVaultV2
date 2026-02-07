import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getSeries } from "@/lib/tmdb";
import { invalidateSeriesCache, invalidateSeriesListCache } from "@/lib/series-data";
import { invalidateHomeCache } from "@/lib/home-data";

/**
 * POST /api/series/[id]/refetch-meta
 * Lädt Titel, Originaltitel, Jahr, Overview, Tagline, Status von TMDb und aktualisiert die Serie.
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

  const s = await prisma.series.findUnique({
    where: { id: idNum },
    select: { id: true, tmdbId: true },
  });
  if (!s?.tmdbId) {
    return NextResponse.json(
      { ok: false, error: "Serie hat keine TMDb-ID" },
      { status: 400 }
    );
  }

  try {
    const d = await getSeries(s.tmdbId);
    if (!d) {
      return NextResponse.json(
        { ok: false, error: "TMDb-Details nicht gefunden" },
        { status: 404 }
      );
    }

    const firstAirYear = d.first_air_date
      ? new Date(d.first_air_date).getFullYear()
      : null;
    const statusText = d.last_air_date
      ? `Letzte Ausstrahlung: ${d.last_air_date}`
      : null;
    const inProduction =
      typeof d.number_of_seasons === "number" ? d.number_of_seasons > 0 : null;

    await prisma.series.update({
      where: { id: idNum },
      data: {
        title: d.name,
        originalTitle: d.original_name ?? null,
        firstAirYear,
        overview: d.overview ?? null,
        tagline: d.tagline ?? null,
        statusText,
        inProduction: inProduction ?? undefined,
      },
    });
    await Promise.all([
      invalidateSeriesCache(idNum),
      invalidateSeriesListCache(),
      invalidateHomeCache(),
    ]);

    return NextResponse.json({
      ok: true,
      title: d.name,
      originalTitle: d.original_name,
      firstAirYear,
      overview: d.overview,
      tagline: d.tagline,
      statusText,
    });
  } catch (e) {
    console.error("refetch-meta (series) failed:", e);
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
