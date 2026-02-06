import Link from "next/link";
import Image from "next/image";
import type { SeriesDetail } from "@/lib/series-data";
import { SeriesHeroActions } from "./SeriesHeroActions";

type Props = { series: SeriesDetail; backUrl: string; canAdmin: boolean };

const accentVar = (s: SeriesDetail) =>
  s.accentColorBackdrop ?? s.accentColor ?? "#FFD700";

export function SeriesHero({ series, backUrl, canAdmin }: Props) {
  const accent = accentVar(series);
  const tmdbUrl = series.tmdbId
    ? `https://www.themoviedb.org/tv/${series.tmdbId}`
    : null;

  return (
    <section
      className="movie-hero hero--accent"
      style={{ ["--accent" as string]: accent }}
    >
      <SeriesHeroActions seriesId={series.id} canAdmin={canAdmin} />
      {series.backdropUrl && (
        <div className="absolute inset-0">
          <Image
            src={series.backdropUrl}
            alt=""
            fill
            className="movie-hero__bg object-cover"
            sizes="100vw"
            priority
            unoptimized={series.backdropUrl.startsWith("http")}
          />
        </div>
      )}
      <div className="movie-hero__overlay" aria-hidden />

      <div className="movie-hero__content">
        <div className="movie-hero__poster">
          {series.posterUrl ? (
            <Image
              src={series.posterUrl}
              alt={series.title}
              width={180}
              height={270}
              className="rounded-xl object-cover shadow-lg"
              unoptimized={series.posterUrl.startsWith("http")}
            />
          ) : (
            <div className="h-[270px] w-[180px] rounded-xl bg-[#1a1a1a]" />
          )}
        </div>
        <div className="movie-hero__meta">
          <h1 className="detail-title">
            {tmdbUrl ? (
              <Link
                href={tmdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hero-link"
                style={{ ["--accent" as string]: series.accentColor ?? "#FFD700" }}
              >
                {series.title}
              </Link>
            ) : (
              <span>{series.title}</span>
            )}
            {series.firstAirYear != null && (
              <span className="year"> ({series.firstAirYear})</span>
            )}
          </h1>
          {series.tagline && <p className="tagline">{series.tagline}</p>}
          <div className="facts">
            <div className="flex flex-wrap gap-x-2 gap-y-1 px-0.5 py-1">
              {series.totalRuntimeText && series.avgRuntimeText && (
                <span className="mx-2.5">
                  Gesamtlaufzeit: {series.totalRuntimeText} (
                  {series.avgRuntimeText} / Median {series.medianRuntimeText})
                </span>
              )}
              {series.seasonCount > 0 && (
                <span className="mx-2.5">
                  {series.seasonCount}{" "}
                  {series.seasonCount === 1 ? "Staffel" : "Staffeln"}
                </span>
              )}
              {series.genresText && (
                <span className="mx-2.5">{series.genresText}</span>
              )}
            </div>
            {series.fsk != null && (
              <span className={`fsk fsk-${series.fsk}`}>FSK {series.fsk}</span>
            )}
          </div>
          {series.overview && <p className="overview">{series.overview}</p>}
          <div className="hero-actions">
            <Link href={backUrl} className="btn">
              Zurück
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
