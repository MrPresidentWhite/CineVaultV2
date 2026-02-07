import Link from "next/link";
import {
  getCollectionsForListPaginated,
  type CollectionListParams,
} from "@/lib/collection-data";
import type { CollectionListItem } from "@/lib/collection-data";
import type { HomeCollection } from "@/lib/home-data";
import { Section } from "@/components/home/Section";
import { FilterSection } from "@/components/home/FilterSection";
import { CollectionCard } from "@/components/home/CollectionCard";
import { Pagination } from "@/components/Pagination";

export const revalidate = 120;

const PAGE_SIZES = [12, 24, 48] as const;
const SORT_OPTIONS: { value: CollectionListParams["sort"]; label: string }[] = [
  { value: "created_desc", label: "Neueste zuerst" },
  { value: "created_asc", label: "Älteste zuerst" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "count_desc", label: "Meiste Filme" },
  { value: "count_asc", label: "Wenigste Filme" },
];

type SearchParams = { [key: string]: string | string[] | undefined };

function parseCollectionListParams(
  searchParams: SearchParams
): CollectionListParams {
  const p = searchParams;
  const num = (k: string) => {
    const v = p[k];
    const n = typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  const tri = (k: string): "any" | "yes" | "no" | undefined => {
    const v = str(k);
    return v === "yes" || v === "no" ? v : undefined;
  };
  return {
    page: num("page") ?? 1,
    pageSize: num("pageSize") ?? 24,
    q: str("q"),
    hasPoster: tri("hasPoster") ?? "any",
    hasCover: tri("hasCover") ?? "any",
    hasBackdrop: tri("hasBackdrop") ?? "any",
    minOneMovie: p.minOneMovie === "1",
    sort:
      (str("sort") as CollectionListParams["sort"]) ?? "created_desc",
  };
}

function buildCollectionsQueryString(
  params: CollectionListParams,
  page?: number
): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.hasPoster && params.hasPoster !== "any")
    sp.set("hasPoster", params.hasPoster);
  if (params.hasCover && params.hasCover !== "any")
    sp.set("hasCover", params.hasCover);
  if (params.hasBackdrop && params.hasBackdrop !== "any")
    sp.set("hasBackdrop", params.hasBackdrop);
  if (params.minOneMovie) sp.set("minOneMovie", "1");
  if (params.sort) sp.set("sort", params.sort);
  sp.set("pageSize", String(params.pageSize ?? 24));
  if (page != null) sp.set("page", String(page));
  return sp.toString();
}

function toHomeCollection(c: CollectionListItem): HomeCollection {
  return {
    id: c.id,
    name: c.name,
    coverUrl: c.coverUrl,
    accentColor: c.accentColor,
    overview: c.overview ?? null,
    movieCount: c.movieCount,
  };
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = parseCollectionListParams(await searchParams);
  const { items, total, page, pageSize, totalPages } =
    await getCollectionsForListPaginated(params);

  const buildHref = (p: number) =>
    `/collections?${buildCollectionsQueryString(params, p)}`;

  return (
    <Section title="Collections" href="/">
      <div className="space-y-6 md:space-y-8">
        <section className="rounded-xl border border-ring bg-panel p-6">
          <h2 className="text-lg font-semibold text-text">Filter</h2>
          <p className="mt-1 text-sm text-text/60">
            Collections nach Kriterien eingrenzen.
          </p>
          <form method="GET" action="/collections" className="mt-4">
            <input type="hidden" name="page" value="1" />
            <FilterSection summary="Filter anzeigen">
              <div className="filter-grid">
                <label>
                  <span>Suche (Name)</span>
                  <input
                    name="q"
                    type="search"
                    defaultValue={params.q ?? ""}
                    placeholder="z. B. Mission Impossible"
                    className="input"
                  />
                </label>
                <label>
                  <span>Poster</span>
                  <select name="hasPoster" defaultValue={params.hasPoster ?? "any"}>
                    <option value="any">— egal —</option>
                    <option value="yes">vorhanden</option>
                    <option value="no">fehlt</option>
                  </select>
                </label>
                <label>
                  <span>Cover</span>
                  <select name="hasCover" defaultValue={params.hasCover ?? "any"}>
                    <option value="any">— egal —</option>
                    <option value="yes">vorhanden</option>
                    <option value="no">fehlt</option>
                  </select>
                </label>
                <label>
                  <span>Backdrop</span>
                  <select name="hasBackdrop" defaultValue={params.hasBackdrop ?? "any"}>
                    <option value="any">— egal —</option>
                    <option value="yes">vorhanden</option>
                    <option value="no">fehlt</option>
                  </select>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="minOneMovie"
                    value="1"
                    defaultChecked={params.minOneMovie ?? false}
                  />
                  <span>nur mit mindestens 1 Film</span>
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
                <Link href="/collections" className="btn">
                  Zurücksetzen
                </Link>
              </div>
            </FilterSection>
          </form>
        </section>

        <section className="rounded-xl border border-ring bg-panel p-6">
          <h2 className="text-lg font-semibold text-text">Ergebnisse</h2>
          {items.length === 0 ? (
            <p className="mt-3 text-text/80">Keine Collections gefunden.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-text/60 break-words">
                {total} {total === 1 ? "Collection" : "Collections"}
                {totalPages > 1 && (
                  <span className="block mt-0.5 sm:inline sm:mt-0"> · Seite {page} von {totalPages}</span>
                )}
              </p>
              <div className="cards cards--collections mt-5">
                {items.map((c) => (
                  <CollectionCard key={c.id} c={toHomeCollection(c)} />
                ))}
              </div>
              <Pagination
                totalPages={totalPages}
                currentPage={page}
                buildHref={buildHref}
                ariaLabel="Collections-Seiten"
              />
            </>
          )}
        </section>
      </div>
    </Section>
  );
}
