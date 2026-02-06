"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

const DEBOUNCE_MS = 220;

type SearchSuggestMovie = {
  id: number;
  title: string;
  year: number | null;
  poster: string | null;
  href: string;
};
type SearchSuggestCollection = {
  id: number;
  name: string;
  poster: string | null;
  href: string;
};
type SearchSuggestSeries = {
  id: number;
  title: string;
  poster: string | null;
  href: string;
};
type SearchResult = {
  movies: SearchSuggestMovie[];
  collections: SearchSuggestCollection[];
  series: SearchSuggestSeries[];
};

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const hrefsRef = useRef<string[]>([]);

  const clearDropdown = useCallback(() => {
    setResult(null);
    setOpen(false);
    setActiveIndex(-1);
    hrefsRef.current = [];
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      clearDropdown();
      return;
    }

    const t = setTimeout(() => {
      if (controllerRef.current) controllerRef.current.abort();
      controllerRef.current = new AbortController();
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
        signal: controllerRef.current.signal,
      })
        .then((r) => (r.ok ? r.json() : { movies: [], collections: [], series: [] }))
        .then((data: SearchResult) => {
          setResult(data);
          const hasAny =
            (data.movies?.length ?? 0) > 0 ||
            (data.collections?.length ?? 0) > 0 ||
            (data.series?.length ?? 0) > 0;
          setOpen(hasAny);
          setActiveIndex(-1);
          hrefsRef.current = [
            ...(data.movies ?? []).map((m) => m.href),
            ...(data.collections ?? []).map((c) => c.href),
            ...(data.series ?? []).map((s) => s.href),
          ];
        })
        .catch(() => clearDropdown());
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, clearDropdown]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        boxRef.current &&
        !boxRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        clearDropdown();
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [clearDropdown]);

  const onBlur = () => {
    setTimeout(clearDropdown, 150);
  };

  const onFocus = () => {
    if (result && hrefsRef.current.length > 0) {
      setOpen(true);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !listRef.current) return;
    const links = listRef.current.querySelectorAll<HTMLAnchorElement>(".search-dd__link");
    if (!links.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % links.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + links.length) % links.length);
    } else if (e.key === "Enter" && activeIndex >= 0 && hrefsRef.current[activeIndex]) {
      e.preventDefault();
      window.location.href = hrefsRef.current[activeIndex];
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearDropdown();
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const links = listRef.current?.querySelectorAll(".search-dd__link");
    links?.forEach((el, i) => {
      (el as HTMLElement).classList.toggle("is-active", i === activeIndex);
    });
    const active = links?.[activeIndex];
    if (active) (active as HTMLAnchorElement).focus();
  }, [open, activeIndex]);

  const hasResults = result && (result.movies.length > 0 || result.collections.length > 0 || result.series.length > 0);

  let flatIndex = 0;
  return (
    <div className="search relative w-full min-w-0 max-w-[min(560px,50%)]" role="search">
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Suche nach Filmen, Collections oder Serien…"
        className="search__input w-full rounded-[10px] border border-ring bg-[#0f0f0f] px-3.5 py-3 text-text outline-none placeholder:text-text/60 focus:border-ring focus:ring-2 focus:ring-ring/40"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={!!(open && hasResults)}
        aria-controls="searchListbox"
        aria-activedescendant={activeIndex >= 0 ? `search-option-${activeIndex}` : undefined}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <div
        ref={boxRef}
        className="search-dd absolute left-0 right-0 top-[calc(100%+8px)] z-[2200] max-h-[60vh] overflow-auto rounded-xl border border-[#2d2d2d] bg-[#171717] px-1.5 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,.35)]"
        hidden={!open || !hasResults}
        role="presentation"
      >
        <ul
          ref={listRef}
          id="searchListbox"
          className="search-dd__list list-none p-0 m-0"
          role="listbox"
        >
          {result?.movies && result.movies.length > 0 && (
            <>
              <li className="search-dd__section py-1.5 px-2 text-xs uppercase tracking-wide text-[#bbb]" role="presentation">
                Filme
              </li>
              {result.movies.map((m) => {
                const idx = flatIndex++;
                return (
                <li key={`m-${m.id}`} className="search-dd__item my-0.5" role="option">
                  <Link
                    id={`search-option-${idx}`}
                    href={m.href}
                    className="search-dd__link grid grid-cols-[38px_1fr_auto] gap-2.5 items-center w-full text-inherit no-underline py-2 px-2.5 rounded-lg hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                  >
                    {m.poster ? (
                      <Image
                        src={m.poster}
                        alt=""
                        width={38}
                        height={54}
                        className="search-dd__thumb h-[54px] w-[38px] rounded-md object-cover bg-[#0f0f0f] border border-[#2d2d2d]"
                        unoptimized={m.poster.startsWith("http")}
                      />
                    ) : (
                      <div className="search-dd__thumb ph h-[54px] w-[38px] rounded-md bg-[#101010] border border-[#2d2d2d]" />
                    )}
                    <span className="search-dd__text min-w-0">
                      <strong className="text-[#eee]">{m.title}</strong>
                      {m.year != null && (
                        <span className="ml-1 text-[#bdbdbd]">({m.year})</span>
                      )}
                    </span>
                    <span className="opacity-60" aria-hidden>›</span>
                  </Link>
                </li>
              );
              })}
            </>
          )}
          {result?.collections && result.collections.length > 0 && (
            <>
              <li className="search-dd__section py-1.5 px-2 text-xs uppercase tracking-wide text-[#bbb]" role="presentation">
                Sammlungen
              </li>
              {result.collections.map((c) => {
                const idx = flatIndex++;
                return (
                <li key={`c-${c.id}`} className="search-dd__item my-0.5" role="option">
                  <Link
                    id={`search-option-${idx}`}
                    href={c.href}
                    className="search-dd__link grid grid-cols-[38px_1fr_auto] gap-2.5 items-center w-full text-inherit no-underline py-2 px-2.5 rounded-lg hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                  >
                    {c.poster ? (
                      <Image
                        src={c.poster}
                        alt=""
                        width={38}
                        height={54}
                        className="search-dd__thumb h-[54px] w-[38px] rounded-md object-cover bg-[#0f0f0f] border border-[#2d2d2d]"
                        unoptimized={c.poster.startsWith("http")}
                      />
                    ) : (
                      <div className="search-dd__thumb ph h-[54px] w-[38px] rounded-md bg-[#101010] border border-[#2d2d2d]" />
                    )}
                    <span className="search-dd__text min-w-0">
                      <strong className="text-[#eee]">{c.name}</strong>
                    </span>
                    <span className="opacity-60" aria-hidden>›</span>
                  </Link>
                </li>
              );
              })}
            </>
          )}
          {result?.series && result.series.length > 0 && (
            <>
              <li className="search-dd__section py-1.5 px-2 text-xs uppercase tracking-wide text-[#bbb]" role="presentation">
                Serien
              </li>
              {result.series.map((s) => {
                const idx = flatIndex++;
                return (
                <li key={`s-${s.id}`} className="search-dd__item my-0.5" role="option">
                  <Link
                    id={`search-option-${idx}`}
                    href={s.href}
                    className="search-dd__link grid grid-cols-[38px_1fr_auto] gap-2.5 items-center w-full text-inherit no-underline py-2 px-2.5 rounded-lg hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                  >
                    {s.poster ? (
                      <Image
                        src={s.poster}
                        alt=""
                        width={38}
                        height={54}
                        className="search-dd__thumb h-[54px] w-[38px] rounded-md object-cover bg-[#0f0f0f] border border-[#2d2d2d]"
                        unoptimized={s.poster.startsWith("http")}
                      />
                    ) : (
                      <div className="search-dd__thumb ph h-[54px] w-[38px] rounded-md bg-[#101010] border border-[#2d2d2d]" />
                    )}
                    <span className="search-dd__text min-w-0">
                      <strong className="text-[#eee]">{s.title}</strong>
                    </span>
                    <span className="opacity-60" aria-hidden>›</span>
                  </Link>
                </li>
              );
              })}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
