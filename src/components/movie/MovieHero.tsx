import Link from "next/link";
import Image from "next/image";
import type { MovieDetail } from "@/lib/movie-data";
import { MovieHeroActions } from "./MovieHeroActions";

type Props = {
  movie: MovieDetail;
  backUrl: string;
  canEdit: boolean;
  canAdmin: boolean;
};

const accentVar = (m: MovieDetail) =>
  m.accentColorBackdrop ?? m.accentColor ?? "#FFD700";

export function MovieHero({ movie, backUrl, canEdit, canAdmin }: Props) {
  const accent = accentVar(movie);
  const tmdbUrl = movie.tmdbId
    ? `https://www.themoviedb.org/movie/${movie.tmdbId}`
    : null;

  return (
    <section
      className="movie-hero hero--accent"
      style={{ ["--accent" as string]: accent }}
    >
      {movie.backdropUrl && (
        <div className="absolute inset-0">
          <Image
            src={movie.backdropUrl}
            alt=""
            fill
            className="movie-hero__bg object-cover"
            sizes="100vw"
            priority
            unoptimized={movie.backdropUrl.startsWith("http")}
          />
        </div>
      )}
      <div className="movie-hero__overlay" aria-hidden />

      <MovieHeroActions
        movieId={movie.id}
        canEdit={canEdit}
        canAdmin={canAdmin}
        placement="top"
      />

      <div className="movie-hero__content">
        <div className="movie-hero__poster">
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt={movie.title}
              width={180}
              height={270}
              className="rounded-xl object-cover shadow-lg"
              unoptimized={movie.posterUrl.startsWith("http")}
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
                style={{ ["--accent" as string]: movie.accentColor ?? "#FFD700" }}
              >
                {movie.title}
              </Link>
            ) : (
              <span>{movie.title}</span>
            )}
            <span className="year"> ({movie.releaseYear})</span>
          </h1>
          {movie.tagline && <p className="tagline">{movie.tagline}</p>}
          <div className="facts">
            <div className="flex flex-wrap gap-x-2 gap-y-1 px-0.5 py-1">
              {movie.runtimeMin > 0 && (
                <span>{movie.runtimeMin} Min</span>
              )}
              {movie.ui.genresText && (
                <span className="mx-2.5">{movie.ui.genresText}</span>
              )}
              {movie.ui.mediaTypeLabel && (
                <span>{movie.ui.mediaTypeLabel}</span>
              )}
            </div>
            {movie.fsk != null && (
              <span className={`fsk fsk-${movie.fsk}`}>FSK {movie.fsk}</span>
            )}
          </div>
          {movie.overview && <p className="overview">{movie.overview}</p>}
          <div className="hero-actions">
            <Link href={backUrl} className="btn">
              Zurück
            </Link>
          </div>
          <MovieHeroActions
            movieId={movie.id}
            canEdit={canEdit}
            canAdmin={canAdmin}
            placement="meta"
          />
        </div>
      </div>
    </section>
  );
}

