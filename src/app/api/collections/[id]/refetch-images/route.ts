import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getMovieDetails, getCollectionDetails } from "@/lib/tmdb";
import { ensureTmdbCached, toPublicUrl } from "@/lib/storage";
import {
  invalidateCollectionCache,
  invalidateCollectionsListCache,
} from "@/lib/collection-data";
import { invalidateHomeCache } from "@/lib/home-data";

/**
 * POST /api/collections/[id]/refetch-images
 * Ermittelt TMDb-Collection-ID aus erstem Film, lädt Poster/Backdrop/Cover von TMDb nach R2.
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

  const col = await prisma.collection.findUnique({
    where: { id: idNum },
    select: {
      id: true,
      name: true,
      movies: {
        select: { tmdbId: true },
        take: 1,
        orderBy: { id: "asc" },
      },
    },
  });

  if (!col) {
    return NextResponse.json(
      { ok: false, error: "Collection nicht gefunden" },
      { status: 404 }
    );
  }

  let tmdbCollectionId: number | null = null;
  if (col.movies.length && col.movies[0].tmdbId) {
    const d = await getMovieDetails(col.movies[0].tmdbId);
    tmdbCollectionId = d?.belongs_to_collection?.id ?? null;
  }

  if (!tmdbCollectionId) {
    return NextResponse.json(
      { ok: false, error: "TMDb-Collection-ID konnte nicht ermittelt werden" },
      { status: 400 }
    );
  }

  try {
    const c = await getCollectionDetails(tmdbCollectionId);
    if (!c) {
      return NextResponse.json(
        { ok: false, error: "TMDb-Collection nicht gefunden" },
        { status: 404 }
      );
    }

    const posterKey = c.poster_path
      ? await ensureTmdbCached({
          filePath: c.poster_path.replace(/^\//, ""),
          size: "w500",
          forceRefetch: true,
        })
      : null;
    const backdropKey = c.backdrop_path
      ? await ensureTmdbCached({
          filePath: c.backdrop_path.replace(/^\//, ""),
          size: "original",
          forceRefetch: true,
        })
      : null;
    const coverKey = c.backdrop_path
      ? await ensureTmdbCached({
          filePath: c.backdrop_path.replace(/^\//, ""),
          size: "w780",
          forceRefetch: true,
        })
      : null;

    await prisma.collection.update({
      where: { id: col.id },
      data: {
        posterUrl: posterKey,
        backdropUrl: backdropKey,
        coverUrl: coverKey,
      },
    });
    await Promise.all([
      invalidateCollectionCache(idNum),
      invalidateCollectionsListCache(),
      invalidateHomeCache(),
    ]);

    return NextResponse.json({
      ok: true,
      posterKey,
      backdropKey,
      coverKey,
      posterUrl: posterKey ? toPublicUrl(posterKey) : null,
      backdropUrl: backdropKey ? toPublicUrl(backdropKey) : null,
    });
  } catch (e) {
    console.error("refetch-images (collection) failed:", e);
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
