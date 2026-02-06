import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getMovieDetails, getCollectionDetails } from "@/lib/tmdb";
import {
  invalidateCollectionCache,
  invalidateCollectionsListCache,
} from "@/lib/collection-data";
import { invalidateHomeCache } from "@/lib/home-data";

/**
 * POST /api/collections/[id]/refetch-meta
 * Ermittelt TMDb-Collection-ID aus erstem Film, lädt Name/Overview von TMDb.
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

    await prisma.collection.update({
      where: { id: col.id },
      data: { name: c.name, overview: c.overview || null },
    });
    await Promise.all([
      invalidateCollectionCache(idNum),
      invalidateCollectionsListCache(),
      invalidateHomeCache(),
    ]);

    return NextResponse.json({
      ok: true,
      name: c.name,
      overview: c.overview,
    });
  } catch (e) {
    console.error("refetch-meta (collection) failed:", e);
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
