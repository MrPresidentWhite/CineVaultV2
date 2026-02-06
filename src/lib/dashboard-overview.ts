/**
 * Dashboard /dashboard – Overview Daten (schlankes Control Center).
 */

import { prisma } from "@/lib/db";
import type { Status } from "@/generated/prisma/enums";

export type OverviewUi = {
  counts: {
    movies: number;
    collections: number;
    series: number;
  };
  processed: {
    fullyProcessed: number;
    pct: number; // 0..1
  };
  todo: Array<{
    status: Status;
    count: number;
  }>;
  recentChanges: Array<{
    id: number;
    movieId: number;
    title: string;
    year: number;
    from: Status;
    to: Status;
    changedAt: Date;
  }>;
};

const TODO_STATUSES: Status[] = [
  "PROCESSING",
  "SHIPPING",
  "VO_SOON",
  "VO_UNKNOWN",
  "ON_WATCHLIST",
  "VB_WISHLIST",
];

export async function getDashboardOverviewUi(): Promise<OverviewUi> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    movieCount,
    collectionCount,
    seriesCount,
    fullyProcessedCount,
    statusGroups,
    recentChanges,
  ] = await Promise.all([
    prisma.movie.count(),
    prisma.collection.count(),
    prisma.series.count(),
    prisma.movie.count({ where: { status: { in: ["UPLOADED", "ARCHIVED"] } } }),
    prisma.movie.groupBy({
      by: ["status"],
      _count: { status: true },
      where: { status: { in: TODO_STATUSES } },
    }),
    prisma.movieStatusChange.findMany({
      where: { changedAt: { gte: since24h } },
      orderBy: { changedAt: "desc" },
      take: 10,
      select: {
        id: true,
        movieId: true,
        from: true,
        to: true,
        changedAt: true,
        movie: { select: { title: true, releaseYear: true } },
      },
    }),
  ]);

  const todoMap = new Map<Status, number>();
  TODO_STATUSES.forEach((s) => todoMap.set(s, 0));
  statusGroups.forEach((g) => {
    const s = (g.status ?? "ON_WATCHLIST") as Status;
    todoMap.set(s, g._count.status ?? 0);
  });

  const todo = TODO_STATUSES.map((status) => ({
    status,
    count: todoMap.get(status) ?? 0,
  }));

  const pct = movieCount > 0 ? fullyProcessedCount / movieCount : 0;

  return {
    counts: {
      movies: movieCount,
      collections: collectionCount,
      series: seriesCount,
    },
    processed: {
      fullyProcessed: fullyProcessedCount,
      pct,
    },
    todo,
    recentChanges: recentChanges.map((c) => ({
      id: c.id,
      movieId: c.movieId,
      title: c.movie.title,
      year: c.movie.releaseYear,
      from: c.from as Status,
      to: c.to as Status,
      changedAt: c.changedAt,
    })),
  };
}

