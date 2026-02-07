/**
 * Status-Scheduled-Job: Filme mit Status „VÖ: Demnächst“ und erreichtem statusScheduledAt
 * auf „Auf Wunschliste“ setzen und MovieStatusChange anlegen (Digest/Notification).
 * Wird per node-cron in instrumentation.ts täglich ausgeführt (z. B. 6:00 Uhr).
 */

import { endOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import { Status as StatusEnum } from "@/generated/prisma/enums";
import { invalidateMovieCache, invalidateMoviesListCache } from "@/lib/movie-data";
import { invalidateHomeCache } from "@/lib/home-data";

export async function runStatusScheduledJob(): Promise<{
  updated: number;
  movieIds: number[];
}> {
  const endOfToday = endOfDay(new Date());
  const movies = await prisma.movie.findMany({
    where: {
      status: StatusEnum.VO_SOON,
      statusScheduledAt: { not: null, lte: endOfToday },
    },
    select: { id: true, statusScheduledAt: true },
  });

  await prisma.$transaction(
    movies.flatMap((m) => [
      prisma.movie.update({
        where: { id: m.id },
        data: {
          status: StatusEnum.VB_WISHLIST,
          statusScheduledAt: null,
        },
      }),
      prisma.movieStatusChange.create({
        data: {
          movieId: m.id,
          from: StatusEnum.VO_SOON,
          to: StatusEnum.VB_WISHLIST,
          fromScheduledAt: m.statusScheduledAt,
          changedBy: null,
        },
      }),
    ])
  );

  const ids = movies.map((m) => m.id);

  if (ids.length > 0) {
    await Promise.all([
      ...ids.map((id) => invalidateMovieCache(id)),
      invalidateMoviesListCache(),
      invalidateHomeCache(),
    ]);
  }

  return { updated: ids.length, movieIds: ids };
}
