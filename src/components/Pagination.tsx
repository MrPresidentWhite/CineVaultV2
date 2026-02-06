import Link from "next/link";

type Props = {
  totalPages: number;
  currentPage: number;
  buildHref: (page: number) => string;
  ariaLabel?: string;
};

const WINDOW = 2;

/**
 * Wiederverwendbare Pagination: Prev, Seitenzahlen (Fenster), Next.
 */
export function Pagination({
  totalPages,
  currentPage,
  buildHref,
  ariaLabel = "Seiten",
}: Props) {
  if (totalPages <= 1) return null;

  const from = Math.max(1, currentPage - WINDOW);
  const to = Math.min(totalPages, currentPage + WINDOW);
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <nav
      className="pagination mt-6 flex flex-wrap items-center justify-center gap-1.5"
      aria-label={ariaLabel}
    >
      {currentPage > 1 ? (
        <Link
          href={buildHref(prevPage)}
          className="btn btn--sm"
          aria-label="Zurück"
        >
          ‹
        </Link>
      ) : (
        <span className="btn btn--sm is-disabled" aria-hidden>
          ‹
        </span>
      )}

      {from > 1 && (
        <>
          <Link href={buildHref(1)} className="btn btn--sm">
            1
          </Link>
          {from > 2 && <span className="px-1.5 opacity-70">…</span>}
        </>
      )}

      {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((p) =>
        p === currentPage ? (
          <span
            key={p}
            className="btn btn--sm btn--primary"
            aria-current="page"
          >
            {p}
          </span>
        ) : (
          <Link key={p} href={buildHref(p)} className="btn btn--sm">
            {p}
          </Link>
        )
      )}

      {to < totalPages && (
        <>
          {to < totalPages - 1 && <span className="px-1.5 opacity-70">…</span>}
          <Link href={buildHref(totalPages)} className="btn btn--sm">
            {totalPages}
          </Link>
        </>
      )}

      {currentPage < totalPages ? (
        <Link
          href={buildHref(nextPage)}
          className="btn btn--sm"
          aria-label="Weiter"
        >
          ›
        </Link>
      ) : (
        <span className="btn btn--sm is-disabled" aria-hidden>
          ›
        </span>
      )}
    </nav>
  );
}
