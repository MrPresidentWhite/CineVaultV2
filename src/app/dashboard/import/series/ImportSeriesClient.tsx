"use client";

import { useState, useRef, useEffect } from "react";
import { SkeletonImage } from "@/components/ui/SkeletonImage";

type SearchResult = {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string | null;
};

type InspectEpisode = {
  episodeNumber: number;
  name: string;
  runtime: number | null;
  stillUrl: string | null;
};

type InspectSeason = {
  seasonNumber: number;
  name: string;
  overview: string | null;
  posterUrl: string | null;
  episodes: InspectEpisode[];
};

type InspectDetails = {
  id: number;
  name: string;
  tagline: string | null;
  overview: string | null;
  first_air_date: string | null;
  last_air_date: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
};

type InspectResponse = {
  details: InspectDetails | null;
  seasons: InspectSeason[];
};

type SeasonSelection = {
  selected: boolean;
  allEpisodes: boolean;
  episodes: Map<number, boolean>;
};

type SelectionState = Map<number, SeasonSelection>;

function ensureSeasonSelection(
  state: SelectionState,
  season: InspectSeason
): SeasonSelection {
  if (!state.has(season.seasonNumber)) {
    const episodes = new Map<number, boolean>();
    for (const ep of season.episodes) {
      episodes.set(ep.episodeNumber, false);
    }
    state.set(season.seasonNumber, {
      selected: false,
      allEpisodes: false,
      episodes,
    });
  }
  return state.get(season.seasonNumber)!;
}

export function ImportSeriesClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [inspect, setInspect] = useState<InspectResponse | null>(null);
  const [selection, setSelection] = useState<SelectionState>(new Map());
  const [running, setRunning] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const searchTimeoutRef = useRef<number | null>(null);
  const seasonsSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!inspect?.details) return;
    const section = seasonsSectionRef.current;
    if (!section) return;
    const scrollParent = section.closest("main");
    const run = () => {
      if (scrollParent) {
        const sectionTop = section.getBoundingClientRect().top;
        const parentTop = scrollParent.getBoundingClientRect().top;
        const top = scrollParent.scrollTop + sectionTop - parentTop - 16;
        scrollParent.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      } else {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [inspect?.details]);

  async function runSearch(q: string) {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoadingSearch(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/import/series/search?q=${encodeURIComponent(q.trim())}`
      );
      if (!res.ok) {
        setError("Suche fehlgeschlagen.");
        setResults([]);
        return;
      }
      const data: SearchResult[] = await res.json();
      setResults(data);
    } catch {
      setError("Netzwerkfehler bei der Suche.");
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }

  async function handleInspect(id: number) {
    setInspect(null);
    setSelection(new Map());
    setError(null);
    setSuccess(null);
    setProgressMsg("Lade Serien-Details …");
    try {
      const res = await fetch(
        `/api/admin/import/series/inspect/${encodeURIComponent(String(id))}`
      );
      if (!res.ok) {
        setError("Serien-Details konnten nicht geladen werden.");
        setProgressMsg(null);
        return;
      }
      const data: InspectResponse = await res.json();
      setResults([]);
      setInspect(data);
      const sel = new Map<number, SeasonSelection>();
      for (const s of data.seasons) {
        ensureSeasonSelection(sel, s);
      }
      setSelection(sel);
      setProgressMsg(null);
    } catch {
      setError("Netzwerkfehler beim Laden der Serien-Details.");
      setProgressMsg(null);
    }
  }

  function toggleSeason(sn: number) {
    if (!inspect) return;
    const seasons = inspect.seasons;
    const season = seasons.find((s) => s.seasonNumber === sn);
    if (!season) return;
    setSelection((prev) => {
      const next = new Map(prev);
      const oldSel = ensureSeasonSelection(next, season);
      const newSelected = !oldSel.selected;
      const newEpisodes = new Map<number, boolean>(oldSel.episodes);
      if (!newSelected) {
        newEpisodes.forEach((_, key) => newEpisodes.set(key, false));
      }
      next.set(sn, {
        selected: newSelected,
        allEpisodes: newSelected ? oldSel.allEpisodes : false,
        episodes: newEpisodes,
      });
      return next;
    });
  }

  function toggleAllEpisodes(sn: number) {
    if (!inspect) return;
    const season = inspect.seasons.find((s) => s.seasonNumber === sn);
    if (!season) return;
    setSelection((prev) => {
      const next = new Map(prev);
      const oldSel = ensureSeasonSelection(next, season);
      if (!oldSel.selected) return next;
      const newAllEpisodes = !oldSel.allEpisodes;
      const newEpisodes = new Map<number, boolean>(oldSel.episodes);
      newEpisodes.forEach((_, key) => newEpisodes.set(key, newAllEpisodes));
      next.set(sn, {
        ...oldSel,
        allEpisodes: newAllEpisodes,
        episodes: newEpisodes,
      });
      return next;
    });
  }

  function toggleEpisode(sn: number, ep: number) {
    if (!inspect) return;
    const season = inspect.seasons.find((s) => s.seasonNumber === sn);
    if (!season) return;
    setSelection((prev) => {
      const next = new Map(prev);
      const oldSel = ensureSeasonSelection(next, season);
      if (!oldSel.selected) return next;
      const newEpisodes = new Map(oldSel.episodes);
      newEpisodes.set(ep, !(oldSel.episodes.get(ep) ?? false));
      let all = true;
      for (const v of newEpisodes.values()) {
        if (!v) {
          all = false;
          break;
        }
      }
      next.set(sn, {
        ...oldSel,
        allEpisodes: all,
        episodes: newEpisodes,
      });
      return next;
    });
  }

  function anySelected(): boolean {
    for (const [, sel] of selection) {
      if (!sel.selected) continue;
      if (sel.allEpisodes) return true;
      for (const v of sel.episodes.values()) {
        if (v) return true;
      }
    }
    return false;
  }

  async function handleImport() {
    if (!inspect?.details) return;
    if (!anySelected()) {
      setError("Bitte mindestens eine Episode oder Staffel auswählen.");
      return;
    }
    setRunning(true);
    setError(null);
    setSuccess(null);
    setProgressMsg("Serien-Import läuft …");

    const seasonsPayload: Array<{
      seasonNumber: number;
      episodes: "ALL" | number[];
    }> = [];
    for (const [sn, sel] of selection) {
      if (!sel.selected) continue;
      const episodes =
        sel.allEpisodes
          ? ("ALL" as const)
          : Array.from(sel.episodes.entries())
              .filter(([, v]) => v)
              .map(([k]) => k);
      if (episodes === "ALL" || episodes.length > 0) {
        seasonsPayload.push({ seasonNumber: sn, episodes });
      }
    }
    if (!seasonsPayload.length) {
      setError("Keine Episoden ausgewählt.");
      setProgressMsg(null);
      setRunning(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/import/series/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: inspect.details.id,
          seasons: seasonsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.error || "Serien-Import fehlgeschlagen. Details siehe Server-Log."
        );
        setProgressMsg(null);
      } else {
        setSuccess("Serie erfolgreich importiert.");
        setProgressMsg("Fertig.");
      }
    } catch {
      setError("Netzwerkfehler beim Serien-Import.");
      setProgressMsg(null);
    } finally {
      setRunning(false);
    }
  }

  const details = inspect?.details ?? null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-brand-ruby/50 bg-brand-ruby/10 px-4 py-3 text-sm text-brand-ruby">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          {success}
        </div>
      )}

      <section className="rounded-xl border border-ring bg-panel p-6 space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">
              TMDb-Suche (Serien)
            </h2>
            <p className="mt-1 text-sm text-text/60">
              Suche nach Serientiteln und wähle Staffeln/Episoden für den
              Import aus.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (searchTimeoutRef.current) {
                window.clearTimeout(searchTimeoutRef.current);
              }
              searchTimeoutRef.current = window.setTimeout(() => {
                runSearch(v);
              }, 250);
            }}
            onBlur={() => runSearch(query)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch(query);
              }
            }}
            placeholder="Serientitel eingeben …"
            className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => runSearch(query)}
            disabled={loadingSearch}
            className="rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/30 disabled:opacity-50"
          >
            {loadingSearch ? "Suche …" : "Suchen"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => {
              const year = r.first_air_date?.slice(0, 4) ?? "?";
              const img =
                r.poster_path != null
                  ? `https://image.tmdb.org/t/p/w185${r.poster_path}`
                  : null;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleInspect(r.id)}
                  className="flex items-center gap-3 rounded-lg border border-ring bg-bg/40 px-3 py-2 text-left text-sm text-text/80 hover:border-accent/60 hover:bg-bg/70"
                >
                  <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-ring">
                    {img ? (
                      <SkeletonImage
                        src={img}
                        alt={r.name}
                        width={74}
                        height={108}
                        className="h-full w-full object-cover"
                        skeletonClassName="rounded-md"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-text">
                      {r.name}
                    </div>
                    <div className="text-xs text-text/60">{year}</div>
                    {r.overview ? (
                      <p className="mt-1 line-clamp-2 text-xs text-text/60">
                        {r.overview}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section
        ref={seasonsSectionRef}
        className="scroll-mt-4 rounded-xl border border-ring bg-panel p-6 space-y-4"
      >
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">
              Staffeln &amp; Episoden auswählen
            </h2>
            <p className="mt-1 text-sm text-text/60">
              Wähle die Staffeln und Episoden, die importiert werden sollen.
            </p>
          </div>
          {progressMsg && (
            <p className="text-xs text-text/50">{progressMsg}</p>
          )}
        </div>

        {!details ? (
          <p className="text-sm text-text/70">
            Wähle zuerst eine Serie über die TMDb-Suche aus.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="w-full max-w-[220px] shrink-0">
                <div className="overflow-hidden rounded-lg border border-ring bg-ring">
                  {details.posterUrl ? (
                    <SkeletonImage
                      src={details.posterUrl}
                      alt={details.name}
                      width={220}
                      height={330}
                      className="h-full w-full object-cover"
                      skeletonClassName="rounded-lg"
                      unoptimized={details.posterUrl.startsWith("http")}
                    />
                  ) : details.backdropUrl ? (
                    <SkeletonImage
                      src={details.backdropUrl}
                      alt={details.name}
                      width={220}
                      height={124}
                      className="h-full w-full object-cover"
                      skeletonClassName="rounded-lg"
                      unoptimized={details.backdropUrl.startsWith("http")}
                    />
                  ) : (
                    <div className="h-[330px] w-full bg-bg/80" />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-text">
                    {details.name}{" "}
                    {details.first_air_date ? (
                      <span className="text-sm text-text/60">
                        ({details.first_air_date.slice(0, 4)}
                        {details.last_air_date
                          ? `–${details.last_air_date.slice(0, 4)}`
                          : ""}
                        )
                      </span>
                    ) : null}
                  </h3>
                  {details.tagline ? (
                    <p className="mt-0.5 text-sm text-text/60">
                      {details.tagline}
                    </p>
                  ) : null}
                  {details.overview ? (
                    <p className="mt-1 text-sm text-text/70 line-clamp-4">
                      {details.overview}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="rounded-lg border border-ring bg-bg px-3 py-1.5 text-xs text-text hover:bg-white/5"
                    onClick={() => {
                      if (!inspect) return;
                      const next = new Map<number, SeasonSelection>();
                      for (const s of inspect.seasons) {
                        const sel = ensureSeasonSelection(next, s);
                        sel.selected = true;
                        sel.allEpisodes = true;
                        sel.episodes.forEach((_, key) =>
                          sel.episodes.set(key, true)
                        );
                      }
                      setSelection(next);
                    }}
                  >
                    Alle Staffeln / Episoden auswählen
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-ring bg-bg px-3 py-1.5 text-xs text-text hover:bg-white/5"
                    onClick={() => {
                      const next = new Map<number, SeasonSelection>();
                      if (inspect) {
                        for (const s of inspect.seasons) {
                          const sel = ensureSeasonSelection(next, s);
                          sel.selected = false;
                          sel.allEpisodes = false;
                          sel.episodes.forEach((_, key) =>
                            sel.episodes.set(key, false)
                          );
                        }
                      }
                      setSelection(next);
                    }}
                  >
                    Alles abwählen
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {inspect?.seasons.map((s) => {
                const sel = selection.get(s.seasonNumber);
                const isSelected = sel?.selected ?? false;
                const allEpisodes = sel?.allEpisodes ?? false;
                return (
                  <article
                    key={s.seasonNumber}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isSelected}
                    className={`rounded-xl border bg-bg/30 cursor-pointer transition select-none ${
                      isSelected
                        ? "border-accent/60 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                        : "border-ring"
                    }`}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("[data-season-body]")) {
                        toggleSeason(s.seasonNumber);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSeason(s.seasonNumber);
                      }
                    }}
                  >
                    <header
                      className="flex items-center justify-between gap-3 border-b border-ring/70 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-8 overflow-hidden rounded bg-ring">
                          {s.posterUrl ? (
                            <SkeletonImage
                              src={s.posterUrl}
                              alt={s.name}
                              width={48}
                              height={72}
                              className="h-full w-full object-cover"
                              skeletonClassName="rounded"
                              unoptimized={s.posterUrl.startsWith("http")}
                            />
                          ) : null}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text">
                            Staffel {s.seasonNumber}
                          </p>
                          <p className="text-xs text-text/60">
                            {s.episodes.length} Episoden
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text/60">
                          {isSelected ? "ausgewählt" : "nicht ausgewählt"}
                        </span>
                      </div>
                    </header>
                    {isSelected && (
                      <section
                        data-season-body
                        className="space-y-3 px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.overview ? (
                          <p className="text-xs text-text/70">{s.overview}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-ring bg-bg px-3 py-1.5 text-xs text-text hover:bg-white/5"
                            onClick={() => toggleAllEpisodes(s.seasonNumber)}
                          >
                            {allEpisodes
                              ? "Alle Episoden abwählen"
                              : "Alle Episoden auswählen"}
                          </button>
                        </div>
                        <div
                          className="mt-2 overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-none py-1 -my-1"
                          onWheel={(e) => {
                            const el = e.currentTarget;
                            const { scrollLeft, scrollWidth, clientWidth } = el;
                            const canScrollLeft = scrollLeft > 0;
                            const canScrollRight =
                              scrollLeft < scrollWidth - clientWidth - 1;
                            const dy = e.deltaY;
                            if (dy === 0) return;
                            if (dy > 0 && canScrollRight) {
                              e.preventDefault();
                              el.scrollLeft += dy;
                            } else if (dy < 0 && canScrollLeft) {
                              e.preventDefault();
                              el.scrollLeft += dy;
                            }
                          }}
                        >
                          <div className="flex gap-3 pb-1">
                            {s.episodes.map((ep) => {
                              const picked =
                                sel?.episodes.get(ep.episodeNumber) ?? false;
                              return (
                                <label
                                  key={ep.episodeNumber}
                                  className={`flex w-56 cursor-pointer flex-col gap-2 rounded-lg border bg-bg/60 p-2 text-xs transition ${
                                    picked
                                      ? "border-accent shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                                      : "border-ring"
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleEpisode(
                                      s.seasonNumber,
                                      ep.episodeNumber
                                    );
                                  }}
                                >
                                  <div className="h-24 w-full overflow-hidden rounded bg-ring aspect-video">
                                    {ep.stillUrl ? (
                                      <SkeletonImage
                                        src={ep.stillUrl}
                                        alt={ep.name || `Episode ${ep.episodeNumber}`}
                                        width={224}
                                        height={126}
                                        className="h-full w-full object-cover"
                                        skeletonClassName="rounded"
                                        unoptimized={ep.stillUrl.startsWith("http")}
                                      />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-text">
                                      E
                                      {String(ep.episodeNumber).padStart(
                                        2,
                                        "0"
                                      )}{" "}
                                      — {ep.name || "Episode"}
                                    </div>
                                    {ep.runtime ? (
                                      <div className="text-[11px] text-text/60">
                                        {ep.runtime} min
                                      </div>
                                    ) : null}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={running || !anySelected()}
                onClick={handleImport}
                className="inline-flex items-center rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/30 disabled:opacity-50"
              >
                {running ? "Serien-Import läuft …" : "Serie importieren"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

