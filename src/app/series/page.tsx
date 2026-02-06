import Link from "next/link";
import {
  getSeriesForListPaginated,
  type SeriesListParams,
} from "@/lib/series-data";
import { Section } from "@/components/home/Section";
import { FilterSection } from "@/components/home/FilterSection";
import { SeriesCard } from "@/components/home/SeriesCard";
import { Pagination } from "@/components/Pagination";

export const revalidate = 120;

const PAGE_SIZES = [12, 24, 48, 96, 120] as const;
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

const SORT_OPTIONS: { value: SeriesListParams["sort"]; label: string }[] = [
  { value: "created_desc", label: "Neueste zuerst" },
  { value: "created_asc", label: "Älteste zuerst" },
  { value: "title_asc", label: "Titel A–Z" },
  { value: "title_desc", label: "Titel Z–A" },
  { value: "year_desc", label: "Jahr absteigend" },
  { value: "year_asc", label: "Jahr aufsteigend" },
  { value: "count_desc", label: "Meiste Staffeln" },
  { value: "count_asc", label: "Wenigste Staffeln" },
];

type SearchParams = { [key: string]: string | string[] | undefined };

function parseSeriesListParams(searchParams: SearchParams): SeriesListParams {
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
    yearFrom: year("yearFrom"),
    yearTo: year("yearTo"),
    sort: (str("sort") as SeriesListParams["sort"]) ?? "created_desc",
  };
}

function buildSeriesQueryString(
  params: SeriesListParams,
  page?: number
): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.yearFrom != null) sp.set("yearFrom", String(params.yearFrom));
  if (params.yearTo != null) sp.set("yearTo", String(params.yearTo));
  if (params.sort) sp.set("sort", params.sort);
  sp.set("pageSize", String(params.pageSize ?? 24));
  if (page != null) sp.set("page", String(page));
  return sp.toString();
}

export default async function SeriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = parseSeriesListParams(await searchParams);
  const { items, total, page, pageSize, totalPages } =
    await getSeriesForListPaginated(params);

  const buildHref = (p: number) =>
    `/series?${buildSeriesQueryString(params, p)}`;

  return (
    <Section title="Serien" href="/">
      <form
        method="GET"
        action="/series"
        className="filter-card mb-4 md:mb-6"
      >
        <input type="hidden" name="page" value="1" />
        <FilterSection summary="Filter anzeigen">
        <div className="filter-grid">
          <label>
            <span>Suche (Titel)</span>
            <input
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="z. B. Breaking Bad"
              className="input"
            />
          </label>
          <label>
            <span>Jahr von</span>
            <input
              name="yearFrom"
              type="number"
              min={YEAR_MIN}
              max={YEAR_MAX}
              defaultValue={params.yearFrom ?? ""}
              className="input"
            />
          </label>
          <label>
            <span>Jahr bis</span>
            <input
              name="yearTo"
              type="number"
              min={YEAR_MIN}
              max={YEAR_MAX}
              defaultValue={params.yearTo ?? ""}
              className="input"
            />
          </label>
          <label>
            <span>Sortierung</span>
            <select name="sort" defaultValue={params.sort ?? "created_desc"}>
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
          <Link href="/series" className="btn">
            Zurücksetzen
          </Link>
        </div>
        </FilterSection>
      </form>

      {items.length === 0 ? (
        <p className="text-text/80">Keine Serien gefunden.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-text/70 break-words">
            {total} {total === 1 ? "Serie" : "Serien"}
            {totalPages > 1 && (
              <span className="block mt-0.5 sm:inline sm:mt-0">Seite {page} von {totalPages}</span>
            )}
          </p>
          <div className="cards cards--movies">
            {items.map((s) => (
              <SeriesCard key={s.id} s={s} />
            ))}
          </div>
          <Pagination
            totalPages={totalPages}
            currentPage={page}
            buildHref={buildHref}
            ariaLabel="Serien-Seiten"
          />
        </>
      )}
    </Section>
  );
}
