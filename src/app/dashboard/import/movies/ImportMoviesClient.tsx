"use client";

import { useState, useRef, useEffect } from "react";
import { SkeletonImage } from "@/components/ui/SkeletonImage";
import Link from "next/link";
import type { Status, Priority, MediaType } from "@/generated/prisma/enums";

type EnumLabels = {
  statusLabels: Record<Status, string>;
  priorityLabels: Record<Priority, string>;
  mediaTypeLabels: Record<MediaType, string>;
};

type ImportMoviesClientProps = {
  enums: EnumLabels;
  users: { id: number; name: string; email: string; role: string }[];
  currentUserId: number | null;
};

type SearchResult = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string | null;
};

type InspectCollectionPart = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  overview: string | null;
  existsId: number | null;
};

type InspectCollectionPayload = {
  id: number;
  name: string;
  overview: string | null;
  parts: InspectCollectionPart[];
};

type CollectionPartOptions = {
  status: Status | "";
  priority: Priority | "";
  mediaType: MediaType | "";
  quality: string;
  assignedTo: string;
  videobusterUrl: string;
  sizeBefore: string;
  sizeAfter: string;
};

type InspectMoviePayload = {
  details: {
    id: number;
    title: string;
    overview?: string | null;
    release_date?: string | null;
    posterUrl: string | null;
    backdropUrl: string | null;
  } | null;
  existsMovieId: number | null;
  collection: InspectCollectionPayload | null;
};

export function ImportMoviesClient({
  enums,
  users,
  currentUserId,
}: ImportMoviesClientProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [inspect, setInspect] = useState<InspectMoviePayload | null>(null);
  const [status, setStatus] = useState<Status | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [mediaType, setMediaType] = useState<MediaType | "">("");
  const [quality, setQuality] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>(
    currentUserId ? String(currentUserId) : ""
  );
  const [videobusterUrl, setVideobusterUrl] = useState("");
  const [sizeBefore, setSizeBefore] = useState("");
  const [sizeAfter, setSizeAfter] = useState("");
  const [running, setRunning] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importedMovieIds, setImportedMovieIds] = useState<number[]>([]);
  const [importedMovieTitles, setImportedMovieTitles] = useState<string[]>([]);

  const [selectedParts, setSelectedParts] = useState<Set<number>>(
    () => new Set()
  );

  const [partOptions, setPartOptions] = useState<
    Record<number, CollectionPartOptions>
  >({});

  const searchTimeoutRef = useRef<number | null>(null);
  const detailsSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!inspect) return;
    const section = detailsSectionRef.current;
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
  }, [inspect]);

  async function runSearch(q: string) {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoadingSearch(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/import/movies/search?q=${encodeURIComponent(q.trim())}`
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
    setProgressMsg("Lade Details …");
    setError(null);
    setSuccess(null);
    setImportedMovieIds([]);
    setImportedMovieTitles([]);
    try {
      const res = await fetch(
        `/api/admin/import/movies/inspect/${encodeURIComponent(String(id))}`
      );
      if (!res.ok) {
        setError("Details konnten nicht geladen werden.");
        setProgressMsg(null);
        return;
      }
      const data: InspectMoviePayload = await res.json();
      setResults([]);
      setInspect(data);
      if (data.collection) {
        const initial = new Set<number>();
        const initialOptions: Record<number, CollectionPartOptions> = {};
        for (const part of data.collection.parts) {
          initialOptions[part.tmdbId] = {
            status: "",
            priority: "",
            mediaType: "",
            quality: "",
            assignedTo: currentUserId ? String(currentUserId) : "",
            videobusterUrl: "",
            sizeBefore: "",
            sizeAfter: "",
          };
          if (!part.existsId) {
            initial.add(part.tmdbId);
          }
        }
        setSelectedParts(initial);
        setPartOptions(initialOptions);
      } else {
        setSelectedParts(new Set());
        setPartOptions({});
      }
      setProgressMsg(null);
    } catch {
      setError("Netzwerkfehler beim Laden der Details.");
      setProgressMsg(null);
    }
  }

  function togglePart(tmdbId: number, disabled: boolean) {
    if (disabled) return;
    setSelectedParts((prev) => {
      const next = new Set(prev);
      if (next.has(tmdbId)) {
        next.delete(tmdbId);
      } else {
        next.add(tmdbId);
      }
      return next;
    });
  }

  async function handleImport() {
    if (!inspect?.details) return;

    const hasCollection = Boolean(inspect.collection);
    // Wenn KEINE Collection vorhanden ist und der Film existiert, abbrechen
    if (!hasCollection && inspect.existsMovieId) {
      return;
    }

    setRunning(true);
    setError(null);
    setSuccess(null);
    setImportedMovieIds([]);
    setImportedMovieTitles([]);
    setProgressPercent(0);
    setProgressMsg("Import läuft …");
    try {
      let res: Response;
      const streamProgress = true;

      if (hasCollection && inspect.collection) {
        const col = inspect.collection;
        const toImport = col.parts.filter(
          (p) => !p.existsId && selectedParts.has(p.tmdbId)
        );

        if (toImport.length === 0) {
          setError("Keine Filme der Collection für den Import ausgewählt.");
          setProgressMsg(null);
          setRunning(false);
          return;
        }

        // Validierung der Größenfelder pro Film
        for (const p of toImport) {
          const opts = partOptions[p.tmdbId];
          if (!opts) continue;
          if (
            (opts.sizeBefore && !/^\d*$/.test(opts.sizeBefore)) ||
            (opts.sizeAfter && !/^\d*$/.test(opts.sizeAfter))
          ) {
            setError(
              `Größe vorher/nachher dürfen nur Ziffern enthalten (Film: "${p.title}").`
            );
            setProgressMsg(null);
            setRunning(false);
            return;
          }
        }

        const moviesPayload = toImport.map((p) => ({
          tmdbId: p.tmdbId,
          status: partOptions[p.tmdbId]?.status || undefined,
          priority: partOptions[p.tmdbId]?.priority || undefined,
          mediaType: partOptions[p.tmdbId]?.mediaType || undefined,
          quality: partOptions[p.tmdbId]?.quality || undefined,
          assignedToUserId: partOptions[p.tmdbId]?.assignedTo
            ? Number(partOptions[p.tmdbId]?.assignedTo)
            : undefined,
          videobusterUrl:
            partOptions[p.tmdbId]?.videobusterUrl || undefined,
          sizeBeforeBytes: partOptions[p.tmdbId]?.sizeBefore || undefined,
          sizeAfterBytes: partOptions[p.tmdbId]?.sizeAfter || undefined,
        }));

        res = await fetch("/api/admin/import/movies/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(streamProgress ? { "X-Stream-Progress": "true" } : {}),
          },
          body: JSON.stringify({ movies: moviesPayload }),
        });
      } else {
        if (!/^\d*$/.test(sizeBefore) || !/^\d*$/.test(sizeAfter)) {
          setError("Größe vorher/nachher dürfen nur Ziffern enthalten.");
          setRunning(false);
          setProgressMsg(null);
          return;
        }
        res = await fetch("/api/admin/import/movies/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(streamProgress ? { "X-Stream-Progress": "true" } : {}),
          },
          body: JSON.stringify({
            tmdbId: inspect.details.id,
            status: status || undefined,
            priority: priority || undefined,
            mediaType: mediaType || undefined,
            quality: quality || undefined,
            assignedToUserId: assignedTo ? Number(assignedTo) : undefined,
            videobusterUrl: videobusterUrl || undefined,
            sizeBeforeBytes: sizeBefore || undefined,
            sizeAfterBytes: sizeAfter || undefined,
          }),
        });
      }

      if (streamProgress && res.body && res.ok) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line) as {
                progress?: number;
                message?: string;
                step?: string;
                id?: number;
                ids?: number[];
                title?: string;
                titles?: string[];
                error?: string;
              };
              if (data.progress != null) setProgressPercent(data.progress);
              if (data.message) setProgressMsg(data.message);
              if (data.step === "done") {
                if (data.id != null && data.title) {
                  setImportedMovieIds([data.id]);
                  setImportedMovieTitles([data.title]);
                  setSuccess(`Film „${data.title}" erfolgreich importiert.`);
                } else if (data.ids?.length && data.titles?.length) {
                  setImportedMovieIds(data.ids);
                  setImportedMovieTitles(data.titles);
                  setSuccess(
                    `${data.ids.length} Filme erfolgreich importiert.`
                  );
                }
                setProgressPercent(100);
                setProgressMsg("Fertig.");
              }
              if (data.step === "error" && data.error) {
                setError(data.error);
                setProgressMsg(null);
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
      } else {
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          setError(
            data.error || "Import fehlgeschlagen. Details siehe Server-Log."
          );
          setProgressMsg(null);
        } else {
          if (data.id != null) {
            setImportedMovieIds([data.id]);
            setSuccess("Film erfolgreich importiert.");
          } else if (data.ids?.length) {
            setImportedMovieIds(data.ids);
            setSuccess(`${data.ids.length} Filme erfolgreich importiert.`);
          }
          setProgressPercent(100);
          setProgressMsg("Fertig.");
        }
      }
    } catch {
      setError("Netzwerkfehler beim Import.");
      setProgressMsg(null);
    } finally {
      setRunning(false);
    }
  }

  const current = inspect?.details;
  const existsId = inspect?.existsMovieId ?? null;
  const collection = inspect?.collection ?? null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-brand-ruby/50 bg-brand-ruby/10 px-4 py-3 text-sm text-brand-ruby">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <p>{success}</p>
          {importedMovieIds.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {importedMovieIds.map((id, i) => (
                <Link
                  key={id}
                  href={`/movies/${id}`}
                  className="font-medium text-green-300 underline decoration-green-400/60 underline-offset-2 hover:text-green-200"
                >
                  {importedMovieTitles[i]
                    ? `${importedMovieTitles[i]} →`
                    : `Film ansehen (#${id}) →`}
                </Link>
              ))}
            </p>
          )}
        </div>
      )}

      <section className="rounded-xl border border-ring bg-panel p-6 space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">
              TMDb-Suche (Filme)
            </h2>
            <p className="mt-1 text-sm text-text/60">
              Suche nach Filmtiteln bei TheMovieDB und importiere Details direkt
              in CineVault.
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
              // Live-Suche mit leichtem Debounce
              searchTimeoutRef.current = window.setTimeout(() => {
                runSearch(v);
              }, 250);
            }}
            placeholder="Filmtitel eingeben …"
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
              const year = r.release_date?.slice(0, 4) ?? "?";
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
                        alt={r.title}
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
                      {r.title}
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
        ref={detailsSectionRef}
        className="scroll-mt-4 rounded-xl border border-ring bg-panel p-6 space-y-4"
      >
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">
              Auswahl &amp; Optionen
            </h2>
            <p className="mt-1 text-sm text-text/60">
              Wähle Status, Priorität und Medium für den Import. Falls der Film
              bereits existiert, wird dies angezeigt.
            </p>
          </div>
          {progressMsg && (
            <p className="text-xs text-text/50">{progressMsg}</p>
          )}
        </div>

        {running && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-ring">
              <div
                className="h-full rounded-full bg-accent/80 transition-[width] duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.round(progressPercent))}%` }}
              />
            </div>
          </div>
        )}

        {!current ? (
          <p className="text-sm text-text/70">
            Wähle zuerst einen Film über die TMDb-Suche aus.
          </p>
        ) : (
          <>
            {collection ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-text">
                      {collection.name}
                    </h3>
                    {collection.overview ? (
                      <p className="mt-1 text-sm text-text/70 line-clamp-4">
                        {collection.overview}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-text/60">
                      Dieser Film gehört zu einer Collection. Bereits vorhandene
                      Filme sind ausgegraut und können nicht erneut importiert
                      werden.
                    </p>
                    {existsId ? (
                      <p className="mt-1 text-xs text-accent">
                        Der ausgewählte Film selbst existiert bereits in
                        CineVault, die übrigen Teile der Collection können aber
                        importiert werden.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2 md:mt-0">
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set<number>();
                        for (const part of collection.parts) {
                          if (!part.existsId) {
                            next.add(part.tmdbId);
                          }
                        }
                        setSelectedParts(next);
                      }}
                      className="rounded-lg border border-ring bg-bg px-3 py-1.5 text-xs font-medium text-text hover:border-accent/60 hover:bg-bg/80"
                    >
                      Alle auswählen
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedParts(new Set())}
                      className="rounded-lg border border-ring bg-bg px-3 py-1.5 text-xs font-medium text-text hover:border-accent/60 hover:bg-bg/80"
                    >
                      Alle abwählen
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {collection.parts.map((part) => {
                    const year =
                      part.releaseYear != null ? String(part.releaseYear) : "?";
                    const disabled = Boolean(part.existsId);
                    const selected = selectedParts.has(part.tmdbId);
                    const opts = partOptions[part.tmdbId] ?? {
                      status: "",
                      priority: "",
                      mediaType: "",
                      quality: "",
                      assignedTo: currentUserId ? String(currentUserId) : "",
                      videobusterUrl: "",
                      sizeBefore: "",
                      sizeAfter: "",
                    };
                    return (
                      <div
                        key={part.tmdbId}
                        className={`flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                          disabled
                            ? "cursor-not-allowed border-ring/40 bg-bg/30 opacity-50"
                            : selected
                            ? "border-accent/70 bg-accent/10"
                            : "border-ring bg-bg/40"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => togglePart(part.tmdbId, disabled)}
                          disabled={disabled}
                          className="flex gap-3 text-left"
                        >
                          <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-ring">
                            {part.posterUrl ? (
                              <SkeletonImage
                                src={part.posterUrl}
                                alt={part.title}
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
                              {part.title}
                            </div>
                            <div className="text-xs text-text/60">
                              {year}
                            </div>
                            {part.overview ? (
                              <p className="mt-1 line-clamp-2 text-xs text-text/60">
                                {part.overview}
                              </p>
                            ) : null}
                            <div className="mt-1 text-xs">
                              {disabled ? (
                                <span className="font-medium text-accent">
                                  Bereits vorhanden – wird übersprungen.
                                </span>
                              ) : selected ? (
                                <span className="text-accent">
                                  Ausgewählt für Import.
                                </span>
                              ) : (
                                <span className="text-text/60">
                                  Klicken, um für den Import auszuwählen.
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        {!disabled && selected && (
                          <div className="grid gap-2 border-t border-ring/40 pt-2 text-xs">
                            <label className="block">
                              <span className="mb-0.5 block text-text/70">
                                Status
                              </span>
                              <select
                                value={opts.status}
                                onChange={(e) =>
                                  setPartOptions((prev) => ({
                                    ...prev,
                                    [part.tmdbId]: {
                                      ...opts,
                                      status: e.target
                                        .value as Status | "",
                                    },
                                  }))
                                }
                                className="w-full rounded-md border border-ring bg-bg px-2 py-1 text-text outline-none focus:border-accent"
                              >
                                <option value="">Standard</option>
                                {(Object.entries(enums.statusLabels) as [
                                  Status,
                                  string,
                                ][]).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-text/70">
                                Priorität
                              </span>
                              <select
                                value={opts.priority}
                                onChange={(e) =>
                                  setPartOptions((prev) => ({
                                    ...prev,
                                    [part.tmdbId]: {
                                      ...opts,
                                      priority: e.target
                                        .value as Priority | "",
                                    },
                                  }))
                                }
                                className="w-full rounded-md border border-ring bg-bg px-2 py-1 text-text outline-none focus:border-accent"
                              >
                                <option value="">Standard</option>
                                {(Object.entries(enums.priorityLabels) as [
                                  Priority,
                                  string,
                                ][]).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-text/70">
                                Medium
                              </span>
                              <select
                                value={opts.mediaType}
                                onChange={(e) =>
                                  setPartOptions((prev) => ({
                                    ...prev,
                                    [part.tmdbId]: {
                                      ...opts,
                                      mediaType: e.target
                                        .value as MediaType | "",
                                    },
                                  }))
                                }
                                className="w-full rounded-md border border-ring bg-bg px-2 py-1 text-text outline-none focus:border-accent"
                              >
                                <option value="">Standard</option>
                                {(Object.entries(enums.mediaTypeLabels) as [
                                  MediaType,
                                  string,
                                ][]).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-text/70">
                                Qualität
                              </span>
                              <input
                                type="text"
                                value={opts.quality}
                                onChange={(e) =>
                                  setPartOptions((prev) => ({
                                    ...prev,
                                    [part.tmdbId]: {
                                      ...opts,
                                      quality: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="z. B. 1080p Remux"
                                className="w-full rounded-md border border-ring bg-bg px-2 py-1 text-text outline-none focus:border-accent"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-text/70">
                                Videobuster-URL
                              </span>
                              <input
                                type="url"
                                value={opts.videobusterUrl}
                                onChange={(e) =>
                                  setPartOptions((prev) => ({
                                    ...prev,
                                    [part.tmdbId]: {
                                      ...opts,
                                      videobusterUrl: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="https://www.videobuster.de/..."
                                className="w-full rounded-md border border-ring bg-bg px-2 py-1 text-text outline-none focus:border-accent"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-text/70">
                                Zugeordnet an
                              </span>
                              <select
                                value={opts.assignedTo}
                                onChange={(e) =>
                                  setPartOptions((prev) => ({
                                    ...prev,
                                    [part.tmdbId]: {
                                      ...opts,
                                      assignedTo: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-md border border-ring bg-bg px-2 py-1 text-text outline-none focus:border-accent"
                              >
                                <option value="">– niemand –</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} | {u.role}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-text/70">
                                Größe vorher (Bytes)
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                value={opts.sizeBefore}
                                onChange={(e) =>
                                  setPartOptions((prev) => ({
                                    ...prev,
                                    [part.tmdbId]: {
                                      ...opts,
                                      sizeBefore: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-md border border-ring bg-bg px-2 py-1 text-text outline-none focus:border-accent"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-text/70">
                                Größe nachher (Bytes)
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                value={opts.sizeAfter}
                                onChange={(e) =>
                                  setPartOptions((prev) => ({
                                    ...prev,
                                    [part.tmdbId]: {
                                      ...opts,
                                      sizeAfter: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-md border border-ring bg-bg px-2 py-1 text-text outline-none focus:border-accent"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={running}
                    onClick={handleImport}
                    className="inline-flex items-center rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/30 disabled:opacity-50"
                  >
                    {running ? "Import läuft …" : "Ausgewählte Filme importieren"}
                  </button>
                </div>
              </div>
            ) : existsId ? (
              <div className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-accent">
                Dieser Film existiert bereits.
              </div>
            ) : (
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="w-full max-w-[200px] shrink-0">
                  <div className="overflow-hidden rounded-lg border border-ring bg-ring">
                    {current.posterUrl ? (
                      <SkeletonImage
                        src={current.posterUrl}
                        alt={current.title}
                        width={200}
                        height={300}
                        className="h-full w-full object-cover"
                        skeletonClassName="rounded-lg"
                        unoptimized={current.posterUrl.startsWith("http")}
                      />
                    ) : current.backdropUrl ? (
                      <SkeletonImage
                        src={current.backdropUrl}
                        alt={current.title}
                        width={200}
                        height={112}
                        className="h-full w-full object-cover"
                        skeletonClassName="rounded-lg"
                        unoptimized={current.backdropUrl.startsWith("http")}
                      />
                    ) : (
                      <div className="h-[300px] w-full bg-bg/80" />
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-text">
                      {current.title}{" "}
                      {current.release_date ? (
                        <span className="text-sm text-text/60">
                          ({current.release_date.slice(0, 4)})
                        </span>
                      ) : null}
                    </h3>
                    {current.overview ? (
                      <p className="mt-1 text-sm text-text/70 line-clamp-4">
                        {current.overview}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-sm text-text/70">
                        Status
                      </span>
                      <select
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as Status | "")
                        }
                        className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                      >
                        <option value="">Standard (Wunschliste)</option>
                        {(Object.entries(enums.statusLabels) as [
                          Status,
                          string,
                        ][]).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-text/70">
                        Priorität
                      </span>
                      <select
                        value={priority}
                        onChange={(e) =>
                          setPriority(e.target.value as Priority | "")
                        }
                        className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                      >
                        <option value="">Standard</option>
                        {(Object.entries(enums.priorityLabels) as [
                          Priority,
                          string,
                        ][]).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-text/70">
                        Medium
                      </span>
                      <select
                        value={mediaType}
                        onChange={(e) =>
                          setMediaType(e.target.value as MediaType | "")
                        }
                        className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                      >
                        <option value="">Blu-ray (Standard)</option>
                        {(Object.entries(enums.mediaTypeLabels) as [
                          MediaType,
                          string,
                        ][]).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-text/70">
                        Qualität (frei)
                      </span>
                      <input
                        type="text"
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        placeholder="z. B. 1080p Remux"
                        className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-text/70">
                        Zugeordnet an
                      </span>
                      <select
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                      >
                        <option value="">– niemand –</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} | {u.role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-text/70">
                        Größe vorher (Bytes)
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        value={sizeBefore}
                        onChange={(e) => setSizeBefore(e.target.value)}
                        className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-text/70">
                        Größe nachher (Bytes)
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        value={sizeAfter}
                        onChange={(e) => setSizeAfter(e.target.value)}
                        className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block sm:col-span-2 lg:col-span-3">
                      <span className="mb-1 block text-sm text-text/70">
                        Videobuster-URL
                      </span>
                      <input
                        type="url"
                        value={videobusterUrl}
                        onChange={(e) => setVideobusterUrl(e.target.value)}
                        placeholder="https://www.videobuster.de/..."
                        className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                      />
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={running}
                      onClick={handleImport}
                      className="inline-flex items-center rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/30 disabled:opacity-50"
                    >
                      {running ? "Import läuft …" : "Film importieren"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

