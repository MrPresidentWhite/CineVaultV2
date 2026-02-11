import Link from "next/link";
import {
  getMoviesForListPaginated,
  type MovieListParams,
} from "@/lib/movie-data";
import { Section } from "@/components/home/Section";
import { FilterSection } from "@/components/home/FilterSection";
import { MovieCard } from "@/components/home/MovieCard";
import { Pagination } from "@/components/Pagination";
import { statusLabels } from "@/lib/enum-mapper";
import { mediaTypeLabels } from "@/lib/enum-mapper";
import type { Status, MediaType } from "@/generated/prisma/enums";

export const revalidate = 120;

const QUALITY_SUGGEST = ["2160p", "1080p", "720p", "576p", "480p"];
const PAGE_SIZES = [12, 24, 48, 96, 120] as const;

type SearchParams = { [key: string]: string | string[] | undefined };

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

function parseMovieListParams(searchParams: SearchParams): MovieListParams {
  const p = searchParams;
  const num = (k: string) => {
    const v = p[k];
    const n = typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };
  const year = (k: string) => {
    const n = num(k);
    return n != null && n >= YEAR_MIN && n <= YEAR_MAX ? n : undefined;
  };
  const str = (k: string) => {
    const v = p[k];
    const s = typeof v === "string" ? v.trim() : "";
    return s || undefined;
  };
  return {
    page: Math.max(1, num("page") ?? 1),
    pageSize: num("pageSize") ?? 24,
    q: str("q"),
    status: str("status"),
    mediaType: str("mediaType"),
    quality: str("quality"),
    yearFrom: year("yearFrom"),
    yearTo: year("yearTo"),
    hasCollection:
      p.hasCollection === "1" ? "1" : p.hasCollection === "0" ? "0" : "",
    minSize: str("minSize"),
    maxSize: str("maxSize"),
  };
}

function buildMoviesQueryString(params: MovieListParams, page?: number): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.mediaType) sp.set("mediaType", params.mediaType);
  if (params.quality) sp.set("quality", params.quality);
  if (params.yearFrom != null) sp.set("yearFrom", String(params.yearFrom));
  if (params.yearTo != null) sp.set("yearTo", String(params.yearTo));
  if (params.hasCollection) sp.set("hasCollection", params.hasCollection);
  if (params.minSize) sp.set("minSize", params.minSize);
  if (params.maxSize) sp.set("maxSize", params.maxSize);
  sp.set("pageSize", String(params.pageSize ?? 24));
  if (page != null) sp.set("page", String(page));
  return sp.toString();
}

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = parseMovieListParams(await searchParams);
  const { items, total, page, totalPages } =
    await getMoviesForListPaginated(params);

  const buildHref = (p: number) =>
    `/movies?${buildMoviesQueryString(params, p)}`;

  return (
    <Section title="Filme" href="/">
      <div className="space-y-6 md:space-y-8">
        <section className="rounded-xl border border-ring bg-panel p-6">
          <h2 className="text-lg font-semibold text-text">Filter</h2>
          <p className="mt-1 text-sm text-text/60">
            Filme nach Kriterien eingrenzen.
          </p>
          <form method="GET" action="/movies" className="mt-4">
            <input type="hidden" name="page" value="1" />
            <FilterSection summary="Filter anzeigen">
            <div className="filter-grid">
          <label>
            <span>Suche (Titel)</span>
            <input
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="z. B. Mission Impossible"
              className="input"
            />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={params.status ?? ""}>
              <option value="">— alle —</option>
              {(Object.entries(statusLabels) as [Status, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </label>
          <label>
            <span>Medientyp</span>
            <select name="mediaType" defaultValue={params.mediaType ?? ""}>
              <option value="">— alle —</option>
              {(Object.entries(mediaTypeLabels) as [MediaType, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </label>
          <label>
            <span>Qualität</span>
            <input
              name="quality"
              type="text"
              defaultValue={params.quality ?? ""}
              placeholder="z. B. 2160p"
              list="quality-list"
              className="input"
            />
            <datalist id="quality-list">
              {QUALITY_SUGGEST.map((q) => (
                <option key={q} value={q} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Jahr von</span>
            <input
              name="yearFrom"
              type="number"
              min={1900}
              max={2100}
              defaultValue={params.yearFrom ?? ""}
              className="input"
            />
          </label>
          <label>
            <span>Jahr bis</span>
            <input
              name="yearTo"
              type="number"
              min={1900}
              max={2100}
              defaultValue={params.yearTo ?? ""}
              className="input"
            />
          </label>
          <label>
            <span>Collection</span>
            <select name="hasCollection" defaultValue={params.hasCollection ?? ""}>
              <option value="">— egal —</option>
              <option value="1">hat Collection</option>
              <option value="0">keine Collection</option>
            </select>
          </label>
          <label>
            <span>Min. Größe (Bytes)</span>
            <input
              name="minSize"
              type="number"
              inputMode="numeric"
              defaultValue={params.minSize ?? ""}
              className="input"
            />
          </label>
          <label>
            <span>Max. Größe (Bytes)</span>
            <input
              name="maxSize"
              type="number"
              inputMode="numeric"
              defaultValue={params.maxSize ?? ""}
              className="input"
            />
          </label>
          <label>
            <span>Pro Seite</span>
            <select name="pageSize" defaultValue={params.pageSize ?? 24}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-actions">
          <button type="submit" className="btn btn--primary">
            Anwenden
          </button>
          <Link href="/movies" className="btn">
            Zurücksetzen
          </Link>
        </div>
            </FilterSection>
          </form>
        </section>

        <section className="rounded-xl border border-ring bg-panel p-6">
          <h2 className="text-lg font-semibold text-text">Ergebnisse</h2>
          {items.length === 0 ? (
            <p className="mt-3 text-text/80">Keine Filme gefunden.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-text/60 break-words">
                {total} {total === 1 ? "Film" : "Filme"}
                {totalPages > 1 && (
                  <span className="block mt-0.5 sm:inline sm:mt-0"> · Seite {page} von {totalPages}</span>
                )}
              </p>
              <div className="cards cards--movies mt-5">
                {items.map((m) => (
                  <MovieCard key={m.id} m={m} />
                ))}
              </div>
              <Pagination
                totalPages={totalPages}
                currentPage={page}
                buildHref={buildHref}
                ariaLabel="Filme-Seiten"
              />
            </>
          )}
        </section>
      </div>
    </Section>
  );
}
