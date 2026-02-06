import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { deleteObject } from "@/lib/storage";
import { invalidateMovieCache, invalidateMoviesListCache } from "@/lib/movie-data";
import { invalidateHomeCache } from "@/lib/home-data";

/**
 * POST /api/movies/[id]/delete
 * Löscht Film und zugehörige R2-Dateien (Poster, Backdrop, Files).
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

  const movie = await prisma.movie.findUnique({
    where: { id: idNum },
    select: {
      id: true,
      posterUrl: true,
      backdropUrl: true,
      files: { select: { path: true } },
    },
  });

  if (!movie) {
    return NextResponse.json(
      { ok: false, error: "Film nicht gefunden" },
      { status: 404 }
    );
  }

  const keysToDelete: string[] = [];
  if (movie.posterUrl) keysToDelete.push(movie.posterUrl);
  if (movie.backdropUrl) keysToDelete.push(movie.backdropUrl);
  movie.files.forEach((f) => {
    if (f.path) keysToDelete.push(f.path);
  });

  await Promise.all(
    keysToDelete.map((key) =>
      deleteObject(key).catch((err) => {
        console.warn(`[DELETE MOVIE] R2 Delete fehlgeschlagen für ${key}:`, (err as Error).message);
      })
    )
  );

  await prisma.movie.delete({ where: { id: idNum } });
  await Promise.all([
    invalidateMovieCache(idNum),
    invalidateMoviesListCache(),
    invalidateHomeCache(),
  ]);

  return NextResponse.json({
    ok: true,
    message: "Film und zugehörige Dateien gelöscht",
  });
}
