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
      className="pagination mt-4 flex flex-wrap items-center justify-center gap-1.5 md:mt-6"
      aria-label={ariaLabel}
    >
      {currentPage > 1 ? (
        <Link
          href={buildHref(prevPage)}
          className="btn btn--sm min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
          aria-label="Zurück"
        >
          ‹
        </Link>
      ) : (
        <span className="btn btn--sm is-disabled min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0" aria-hidden>
          ‹
        </span>
      )}

      {from > 1 && (
        <>
          <Link href={buildHref(1)} className="btn btn--sm min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0">
            1
          </Link>
          {from > 2 && <span className="px-1.5 opacity-70">…</span>}
        </>
      )}

      {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((p) =>
        p === currentPage ? (
          <span
            key={p}
            className="btn btn--sm btn--primary min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            aria-current="page"
          >
            {p}
          </span>
        ) : (
          <Link key={p} href={buildHref(p)} className="btn btn--sm min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0">
            {p}
          </Link>
        )
      )}

      {to < totalPages && (
        <>
          {to < totalPages - 1 && <span className="px-1.5 opacity-70">…</span>}
          <Link href={buildHref(totalPages)} className="btn btn--sm min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0">
            {totalPages}
          </Link>
        </>
      )}

      {currentPage < totalPages ? (
        <Link
          href={buildHref(nextPage)}
          className="btn btn--sm min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
          aria-label="Weiter"
        >
          ›
        </Link>
      ) : (
        <span className="btn btn--sm is-disabled min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0" aria-hidden>
          ›
        </span>
      )}
    </nav>
  );
}
