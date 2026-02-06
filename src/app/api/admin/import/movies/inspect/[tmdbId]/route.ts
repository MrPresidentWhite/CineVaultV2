import { NextResponse } from "next/server";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getMovieDetails, getCollectionDetails, tmdbImg } from "@/lib/tmdb";
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
    const d = await getMovieDetails(idNum);
    if (!d) {
      return NextResponse.json(
        { ok: false, error: "Film bei TMDb nicht gefunden" },
        { status: 404 }
      );
    }

    const year = d.release_date ? new Date(d.release_date).getFullYear() : null;
    const exists = await prisma.movie.findFirst({
      where: {
        OR: [
          { tmdbId: d.id },
          {
            AND: [
              { title: d.title },
              ...(year ? [{ releaseYear: year }] : []),
            ],
          },
        ],
      },
      select: { id: true },
    });

    // Poster/Backdrop über R2 cachen
    const [posterKey, backdropKey] = await Promise.all([
      d.poster_path
        ? ensureTmdbCached({ filePath: d.poster_path, size: "w500" })
        : Promise.resolve<string | null>(null),
      d.backdrop_path
        ? ensureTmdbCached({ filePath: d.backdrop_path, size: "w780" })
        : Promise.resolve<string | null>(null),
    ]);

    let collection: unknown = null;
    if (d.belongs_to_collection?.id) {
      try {
        const col = await getCollectionDetails(d.belongs_to_collection.id);
        const parts = await Promise.all(
          (col.parts ?? []).map(async (p) => {
            const y = p.release_date
              ? new Date(p.release_date).getFullYear()
              : null;
            const existsPart = await prisma.movie.findFirst({
              where: {
                OR: [
                  { tmdbId: p.id },
                  {
                    AND: [
                      { title: p.title },
                      ...(y ? [{ releaseYear: y }] : []),
                    ],
                  },
                ],
              },
              select: { id: true },
            });
            return {
              tmdbId: p.id,
              title: p.title,
              releaseYear: y,
              posterUrl: tmdbImg.poster(p.poster_path, "w185"),
              overview: p.overview ?? null,
              existsId: existsPart?.id ?? null,
            };
          })
        );
        collection = {
          id: col.id,
          name: col.name,
          overview: col.overview ?? null,
          parts,
        };
      } catch (e) {
        console.warn("Import inspectMovie collection fetch failed:", e);
      }
    }

    return NextResponse.json({
      details: {
        id: d.id,
        title: d.title,
        overview: d.overview ?? null,
        release_date: d.release_date ?? null,
        posterUrl: posterKey ? toPublicUrl(posterKey) : null,
        backdropUrl: backdropKey ? toPublicUrl(backdropKey) : null,
      },
      existsMovieId: exists?.id ?? null,
      collection,
    });
  } catch (e) {
    console.error("Import inspectMovie error:", e);
    return NextResponse.json(
      { ok: false, error: "Fehler beim Laden der TMDb-Details" },
      { status: 500 }
    );
  }
}

