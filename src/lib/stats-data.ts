/**
 * Statistiken für Dashboard (Filme, Speicher, FSK, Medientyp).
 */

import { prisma } from "@/lib/db";
import { mediaTypeLabels } from "@/lib/enum-mapper";
import type { MediaType } from "@/generated/prisma/enums";

function fmtBytes(n: bigint | number): string {
  const num = typeof n === "bigint" ? Number(n) : n;
  if (!Number.isFinite(num) || num === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let x = num;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(nums: number[], p: number): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const weight = rank - lo;
  return sorted[lo] * (1 - weight) + (sorted[hi] ?? sorted[lo]) * weight;
}

export type StatsUi = {
  beforeSumAll: string;
  afterSumAll: string;
  savedTotalStrict: string;
  savedPctStrict: string;
  savedPctStrictValue: number;
  avgSavedPerFilm: string;
  medianSavedBytes: string;
  p90SavedBytes: string;
  medianSavedPct: string;
  p90SavedPct: string;
  movieCount: number;
  fullyProcessedCount: number;
  singleCount: number;
  collectionsCount: number;
  moviesInCollections: number;
  fskLabels: string[];
  fskCounts: number[];
  mediaLabels: string[];
  mediaCounts: number[];
  mediaSavedGiB: number[];
};

export async function getStats(): Promise<StatsUi> {
  const [movieAgg, savingsData, fullyProcessedCount, singleMovies, moviesInCollections, collectionsCount, fskGroups, mediaGroups] =
    await Promise.all([
      prisma.movie.aggregate({
        _count: { id: true },
        _sum: { sizeBeforeBytes: true, sizeAfterBytes: true },
      }),
      prisma.movie.findMany({
        where: {
          sizeBeforeBytes: { not: null, gt: 0 },
          sizeAfterBytes: { not: null },
        },
        select: { sizeBeforeBytes: true, sizeAfterBytes: true },
      }),
      prisma.movie.count({
        where: { status: { in: ["UPLOADED", "ARCHIVED"] } },
      }),
      prisma.movie.count({ where: { collectionId: null } }),
      prisma.movie.count({ where: { collectionId: { not: null } } }),
      prisma.collection.count(),
      prisma.movie.groupBy({
        by: ["fsk"],
        _count: { fsk: true },
      }),
      prisma.movie.groupBy({
        by: ["mediaType"],
        _count: { mediaType: true },
        _sum: { sizeBeforeBytes: true, sizeAfterBytes: true },
      }),
    ]);

  const beforeSumAll = movieAgg._sum.sizeBeforeBytes ?? 0n;
  const afterSumAll = movieAgg._sum.sizeAfterBytes ?? 0n;
  const perFilmSavedBytes: number[] = [];
  const perFilmSavedPct: number[] = [];
  let savedTotalStrict = 0n;
  for (const m of savingsData) {
    const before = m.sizeBeforeBytes!;
    const after = m.sizeAfterBytes!;
    if (before > after) {
      const saved = before - after;
      savedTotalStrict += saved;
      perFilmSavedBytes.push(Number(saved));
      perFilmSavedPct.push(Number(saved) / Number(before));
    }
  }
  const savedPctStrict =
    beforeSumAll > 0n ? Number(savedTotalStrict) / Number(beforeSumAll) : 0;
  const avgSavedPerFilm =
    perFilmSavedBytes.length > 0
      ? Number(savedTotalStrict) / perFilmSavedBytes.length
      : 0;
  const medianSavedBytesNum = median(perFilmSavedBytes);
  const p90SavedBytesNum = percentile(perFilmSavedBytes, 90);
  const medianSavedPctNum = median(perFilmSavedPct);
  const p90SavedPctNum = percentile(perFilmSavedPct, 90);

  const fskBuckets: Record<string, number> = {
    "0": 0,
    "6": 0,
    "12": 0,
    "16": 0,
    "18": 0,
    null: 0,
  };
  fskGroups.forEach((g) => {
    const key = g.fsk === null ? "null" : String(g.fsk);
    fskBuckets[key] = g._count.fsk;
  });
  const FSK_ORDER = [0, 6, 12, 16, 18, null] as const;
  const fskLabels = FSK_ORDER.map((v) =>
    v === null ? "Unbekannt" : `FSK ${v}`
  );
  const fskCounts = FSK_ORDER.map((v) => fskBuckets[String(v)] ?? 0);

  const mediaAgg: Record<MediaType | "UNKNOWN", { count: number; savedGB: number }> = {
    UHD_4K: { count: 0, savedGB: 0 },
    BLURAY: { count: 0, savedGB: 0 },
    DVD: { count: 0, savedGB: 0 },
    UNKNOWN: { count: 0, savedGB: 0 },
  };
  mediaGroups.forEach((g) => {
    const type = (g.mediaType ?? "UNKNOWN") as keyof typeof mediaAgg;
    if (type in mediaAgg) {
      mediaAgg[type].count = g._count.mediaType ?? 0;
      const before = g._sum.sizeBeforeBytes ?? 0n;
      const after = g._sum.sizeAfterBytes ?? 0n;
      const savedBytes = before > after ? before - after : 0n;
      mediaAgg[type].savedGB = Number(savedBytes) / 1e9;
    }
  });
  const mediaLabels = [
    mediaTypeLabels.UHD_4K,
    mediaTypeLabels.BLURAY,
    mediaTypeLabels.DVD,
  ];
  const mediaCounts = [
    mediaAgg.UHD_4K.count,
    mediaAgg.BLURAY.count,
    mediaAgg.DVD.count,
  ];
  const mediaSavedGiB = [
    Number(mediaAgg.UHD_4K.savedGB.toFixed(2)),
    Number(mediaAgg.BLURAY.savedGB.toFixed(2)),
    Number(mediaAgg.DVD.savedGB.toFixed(2)),
  ];

  return {
    beforeSumAll: fmtBytes(beforeSumAll),
    afterSumAll: fmtBytes(afterSumAll),
    savedTotalStrict: fmtBytes(savedTotalStrict),
    savedPctStrict: `${(savedPctStrict * 100).toFixed(2)} %`,
    savedPctStrictValue: savedPctStrict,
    avgSavedPerFilm: fmtBytes(avgSavedPerFilm),
    medianSavedBytes: fmtBytes(medianSavedBytesNum),
    p90SavedBytes: fmtBytes(p90SavedBytesNum),
    medianSavedPct: `${(medianSavedPctNum * 100).toFixed(2)} %`,
    p90SavedPct: `${(p90SavedPctNum * 100).toFixed(2)} %`,
    movieCount: movieAgg._count.id,
    fullyProcessedCount,
    singleCount: singleMovies,
    collectionsCount,
    moviesInCollections,
    fskLabels,
    fskCounts,
    mediaLabels,
    mediaCounts,
    mediaSavedGiB,
  };
}
