import { NextResponse } from "next/server";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/bulk-refetch/counts
 * Liefert Anzahlen für Bulk Refetch (Filme/Serien/Collections mit TMDb-ID).
 * Erfordert ADMIN.
 */
export async function GET() {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const [movies, series, collections] = await Promise.all([
    prisma.movie.count({ where: { tmdbId: { not: null } } }),
    prisma.series.count({ where: { tmdbId: { not: null } } }),
    prisma.collection.count({
      where: { movies: { some: { tmdbId: { not: null } } } },
    }),
  ]);

  return NextResponse.json({ movies, series, collections });
}
