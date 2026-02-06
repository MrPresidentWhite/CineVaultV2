import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { deleteObject } from "@/lib/storage";
import { invalidateSeriesCache, invalidateSeriesListCache } from "@/lib/series-data";
import { invalidateHomeCache } from "@/lib/home-data";

/**
 * POST /api/series/[id]/delete
 * Löscht Serie und zugehörige R2-Dateien (Poster, Backdrop, Season-Poster, Episode-Stills, Files).
 * Erfordert ADMIN.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ ok: false, error: "Ungültige ID" }, { status: 400 });
  }

  const series = await prisma.series.findUnique({
    where: { id: idNum },
    select: {
      id: true,
      posterUrl: true,
      backdropUrl: true,
      seasons: {
        select: { posterUrl: true, episodes: { select: { stillUrl: true, files: { select: { path: true } } } } },
      },
    },
  });

  if (!series) {
    return NextResponse.json(
      { ok: false, error: "Serie nicht gefunden" },
      { status: 404 }
    );
  }

  const keysToDelete: string[] = [];
  if (series.posterUrl) keysToDelete.push(series.posterUrl);
  if (series.backdropUrl) keysToDelete.push(series.backdropUrl);
  for (const season of series.seasons) {
    if (season.posterUrl) keysToDelete.push(season.posterUrl);
    for (const ep of season.episodes) {
      if (ep.stillUrl) keysToDelete.push(ep.stillUrl);
      for (const f of ep.files) {
        if (f.path) keysToDelete.push(f.path);
      }
    }
  }

  await Promise.all(
    keysToDelete.map((key) =>
      deleteObject(key).catch((err) => {
        console.warn(`[DELETE SERIES] R2 Delete fehlgeschlagen für ${key}:`, (err as Error).message);
      })
    )
  );

  await prisma.series.delete({ where: { id: idNum } });
  await Promise.all([
    invalidateSeriesCache(idNum),
    invalidateSeriesListCache(),
    invalidateHomeCache(),
  ]);

  return NextResponse.json({
    ok: true,
    message: "Serie und zugehörige Dateien gelöscht",
  });
}
