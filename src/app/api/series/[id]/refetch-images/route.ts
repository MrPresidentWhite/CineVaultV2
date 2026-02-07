import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getSeries } from "@/lib/tmdb";
import { ensureTmdbCached, getObjectAsBuffer, toPublicUrl } from "@/lib/storage";
import { getAccentFromBuffer } from "@/lib/accent";
import { invalidateSeriesCache, invalidateSeriesListCache } from "@/lib/series-data";
import { invalidateHomeCache } from "@/lib/home-data";

/**
 * POST /api/series/[id]/refetch-images
 * Lädt Poster und Backdrop von TMDb, speichert in R2 (mit cv-sha256-Duplicate-Check),
 * berechnet Akzentfarben neu und aktualisiert die Serie. Erfordert EDITOR.
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

    const posterKey = d.poster_path
      ? await ensureTmdbCached({
          filePath: d.poster_path.replace(/^\//, ""),
          size: "w500",
          forceRefetch: true,
        })
      : null;
    const backdropKey = d.backdrop_path
      ? await ensureTmdbCached({
          filePath: d.backdrop_path.replace(/^\//, ""),
          size: "w780",
          forceRefetch: true,
        })
      : null;

    const [posterBuf, backdropBuf] = await Promise.all([
      posterKey ? getObjectAsBuffer(posterKey) : Promise.resolve(null),
      backdropKey ? getObjectAsBuffer(backdropKey) : Promise.resolve(null),
    ]);
    const accentColor = await getAccentFromBuffer(posterBuf);
    const accentColorBackdrop = backdropKey
      ? await getAccentFromBuffer(backdropBuf)
      : null;

    await prisma.series.update({
      where: { id: idNum },
      data: {
        posterUrl: posterKey,
        backdropUrl: backdropKey,
        accentColor,
        accentColorBackdrop,
      },
    });
    await Promise.all([
      invalidateSeriesCache(idNum),
      invalidateSeriesListCache(),
      invalidateHomeCache(),
    ]);

    return NextResponse.json({
      ok: true,
      posterKey,
      backdropKey,
      posterUrl: posterKey ? toPublicUrl(posterKey) : null,
      backdropUrl: backdropKey ? toPublicUrl(backdropKey) : null,
      accentColor,
      accentColorBackdrop,
    });
  } catch (e) {
    console.error("refetch-images (series) failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Bilder konnten aktuell nicht von TMDb geladen werden – versuch es in ein paar Minuten nochmal",
      },
      { status: 503 }
    );
  }
}
