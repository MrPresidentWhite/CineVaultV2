import { requireAuth } from "@/lib/auth";
import { getStats } from "@/lib/stats-data";
import { StatsCharts } from "@/components/dashboard/StatsCharts";

export default async function DashboardStatsPage() {
  await requireAuth({ callbackUrl: "/dashboard/stats" });
  const ui = await getStats();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Statistiken
      </h1>

      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">
          Speicher &amp; Kompression
        </h2>
        <p className="mt-1 text-sm text-text/60">
          Überblick über Speicher vorher/nachher und typische Ersparniswerte pro
          Film.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Speicher vorher</p>
            <p className="mt-1 text-xl font-bold text-text">{ui.beforeSumAll}</p>
          </div>
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Speicher nachher</p>
            <p className="mt-1 text-xl font-bold text-text">{ui.afterSumAll}</p>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5">
            <p className="text-sm font-medium text-green-400/90">
              Ersparnis gesamt
            </p>
            <p className="mt-1 text-xl font-bold text-green-400">
              {ui.savedTotalStrict}
              <span className="ml-1 text-sm font-normal text-green-400/80">
                ({ui.savedPctStrict})
              </span>
            </p>
            <p className="mt-2 text-xs text-green-200/70">
              Nur positive Ersparnis (vorher &gt; nachher).
            </p>
          </div>
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-5">
            <p className="text-sm font-medium text-accent/90">
              Vollständig verarbeitet
            </p>
            <p className="mt-1 text-xl font-bold text-accent">
              {ui.fullyProcessedCount}
              <span className="ml-1 text-sm font-normal text-accent/80">
                (
                {ui.movieCount > 0
                  ? ((ui.fullyProcessedCount / ui.movieCount) * 100).toFixed(1)
                  : 0}{" "}
                %)
              </span>
            </p>
            <p className="mt-2 text-xs text-accent/70">
              Status „Hochgeladen“ oder „Archiviert“.
            </p>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">
              Ø Ersparnis / Median / p90
            </p>
            <p className="mt-1 text-lg font-bold text-text">
              {ui.avgSavedPerFilm} / {ui.medianSavedBytes} / {ui.p90SavedBytes}
            </p>
            <p className="mt-2 text-xs text-text/50">
              p90: 90% der Filme sparen ≤ diesem Wert.
            </p>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">
              Median / p90 (in %)
            </p>
            <p className="mt-1 text-lg font-bold text-text">
              {ui.medianSavedPct} / {ui.p90SavedPct}
            </p>
            <p className="mt-2 text-xs text-text/50">
              Prozentual relativ zu „vorher“ pro Film.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Bibliothek</h2>
        <p className="mt-1 text-sm text-text/60">
          Größenordnung deiner Sammlung und wie sie sich zusammensetzt.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Filme insgesamt</p>
            <p className="mt-1 text-2xl font-bold text-text">{ui.movieCount}</p>
          </div>
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Einzelfilme</p>
            <p className="mt-1 text-2xl font-bold text-text">
              {ui.singleCount}
            </p>
          </div>
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Collections</p>
            <p className="mt-1 text-2xl font-bold text-text">
              {ui.collectionsCount}
            </p>
            <p className="mt-2 text-xs text-text/50">
              Filme in Collections:{" "}
              <span className="text-text/70 font-medium">
                {ui.moviesInCollections}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">
              Anteil verarbeitet
            </p>
            <p className="mt-1 text-2xl font-bold text-text">
              {ui.movieCount > 0
                ? `${((ui.fullyProcessedCount / ui.movieCount) * 100).toFixed(
                    1
                  )} %`
                : "0 %"}
            </p>
            <p className="mt-2 text-xs text-text/50">
              Basis: „Hochgeladen“ + „Archiviert“.
            </p>
          </div>
        </div>
      </section>

      <StatsCharts
        fskLabels={ui.fskLabels}
        fskCounts={ui.fskCounts}
        mediaLabels={ui.mediaLabels}
        mediaCounts={ui.mediaCounts}
        mediaSavedGiB={ui.mediaSavedGiB}
      />
    </div>
  );
}
