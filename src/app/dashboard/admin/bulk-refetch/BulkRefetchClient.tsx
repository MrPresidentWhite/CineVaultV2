"use client";

import { useState, useEffect, useCallback } from "react";

type Counts = { movies: number; series: number; collections: number };

type LogEntry = {
  type: "movie" | "series" | "collection";
  id: number;
  name: string;
  result: "updated" | "skipped" | "error";
  message?: string;
};

type RunResult = {
  done: boolean;
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  log: LogEntry[];
};

const BATCH_LIMIT = 5;
const DELAY_MS = 300;

export function BulkRefetchClient() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [type, setType] = useState<"movies" | "series" | "collections" | "all">("movies");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<{ updated: number; skipped: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    setLoadingCounts(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bulk-refetch/counts");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Counts konnten nicht geladen werden.");
      }
      const data = await res.json();
      setCounts({ movies: data.movies ?? 0, series: data.series ?? 0, collections: data.collections ?? 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const getTotalForType = useCallback(
    (t: "movies" | "series" | "collections" | "all") => {
      if (!counts) return 0;
      if (t === "all") return counts.movies + counts.series + counts.collections;
      return counts[t];
    },
    [counts]
  );

  const runBatch = useCallback(
    async (
      kind: "movies" | "series" | "collections",
      offset: number
    ): Promise<RunResult> => {
      const res = await fetch("/api/admin/bulk-refetch/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: kind,
          offset,
          limit: BATCH_LIMIT,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Request fehlgeschlagen: ${res.status}`);
      }
      return res.json();
    },
    []
  );

  const runAll = useCallback(async () => {
    if (!counts) return;
    setRunning(true);
    setLog([]);
    setSummary(null);
    setError(null);

    const total = getTotalForType(type);
    setProgress({ current: 0, total });

    let current = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    const typesToRun: ("movies" | "series" | "collections")[] =
      type === "all" ? ["movies", "series", "collections"] : [type];

    try {
      for (const kind of typesToRun) {
        const typeTotal =
          kind === "movies"
            ? counts.movies
            : kind === "series"
              ? counts.series
              : counts.collections;
        let offset = 0;

        while (offset < typeTotal) {
          const result: RunResult = await runBatch(kind, offset);
          setLog((prev) => [...prev, ...result.log]);
          current += result.processed;
          totalUpdated += result.updated;
          totalSkipped += result.skipped;
          totalErrors += result.errors;
          setProgress({ current, total });
          setSummary({
            updated: totalUpdated,
            skipped: totalSkipped,
            errors: totalErrors,
          });

          if (result.done) break;
          offset += result.processed;
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      }

      setSummary({
        updated: totalUpdated,
        skipped: totalSkipped,
        errors: totalErrors,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [counts, type, getTotalForType, runBatch]);

  const total = getTotalForType(type);

  return (
    <div className="space-y-6 rounded-xl border border-ring bg-panel p-6">
      {loadingCounts ? (
        <p className="text-sm text-text/60">Lade Anzahlen…</p>
      ) : error && !counts ? (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm font-medium text-text/80">Typ:</span>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "movies" | "series" | "collections" | "all")
                }
                disabled={running}
                className="rounded-lg border border-ring bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              >
                <option value="movies">
                  Filme ({counts?.movies ?? 0})
                </option>
                <option value="series">
                  Serien ({counts?.series ?? 0})
                </option>
                <option value="collections">
                  Collections ({counts?.collections ?? 0})
                </option>
                <option value="all">
                  Alles ({total})
                </option>
              </select>
            </label>
            <button
              type="button"
              onClick={runAll}
              disabled={running || total === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {running ? "Läuft…" : "Start"}
            </button>
            {counts && (
              <span className="text-sm text-text/60">
                Gesamt: {total} Einträge · Batch: {BATCH_LIMIT}
              </span>
            )}
          </div>

          {running && total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-text/80">
                <span>Fortschritt</span>
                <span>
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{
                    width: `${
                      progress.total > 0
                        ? Math.min(100, (progress.current / progress.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {summary && !running && (
            <p className="text-sm text-text/80">
              <strong>Ergebnis:</strong> {summary.updated} aktualisiert,{" "}
              {summary.skipped} übersprungen, {summary.errors} Fehler.
            </p>
          )}

          {error && running === false && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          {log.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-text/80">Log</h2>
              <div className="max-h-[320px] overflow-y-auto rounded-lg border border-ring bg-bg p-3 font-mono text-xs">
                {log.map((entry, i) => (
                  <div
                    key={`${entry.type}-${entry.id}-${i}`}
                    className={`flex flex-wrap gap-x-2 gap-y-0.5 py-0.5 ${
                      entry.result === "updated"
                        ? "text-green-600 dark:text-green-400"
                        : entry.result === "skipped"
                          ? "text-text/60"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    <span className="shrink-0">
                      [{entry.type}] {entry.name} (ID {entry.id})
                    </span>
                    <span className="shrink-0 font-medium">
                      {entry.result === "updated"
                        ? "✓ aktualisiert"
                        : entry.result === "skipped"
                          ? "– übersprungen"
                          : "✗ Fehler"}
                    </span>
                    {entry.message && (
                      <span className="text-text/70">{entry.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
