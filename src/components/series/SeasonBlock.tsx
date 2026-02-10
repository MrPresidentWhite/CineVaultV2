 "use client";

import { useState } from "react";
import Image from "next/image";
import { SkeletonImage } from "@/components/ui/SkeletonImage";
import type { SeriesDetailSeason } from "@/lib/series-data";
import { EpisodeRow } from "./EpisodeRow";

type Props = {
  season: SeriesDetailSeason;
  seriesAccent: string;
  canEdit: boolean;
  onEditEpisode: (ep: import("@/lib/series-data").SeriesDetailEpisode) => void;
};

function formatAirYear(d: Date | null): string | null {
  return d ? new Date(d).getFullYear().toString() : null;
}

export function SeasonBlock({
  season,
  seriesAccent,
  canEdit,
  onEditEpisode,
}: Props) {
  const [open, setOpen] = useState(false);
  const accent = season.accentColor ?? seriesAccent;
  const airYear = formatAirYear(season.airDate);
  const epCount = season.episodes.length;

  return (
    <section
      className="cv-sea season"
      id={`season-${season.seasonNumber}`}
      style={{ ["--series-accent" as string]: accent }}
    >
      <div
        className="cv-sea season__header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        {season.posterUrl ? (
          <div className="cv-sea season__posterWrap">
            <SkeletonImage
              src={season.posterUrl}
              alt={`Staffel ${season.seasonNumber} Poster`}
              width={128}
              height={180}
              className="cv-sea season__poster object-cover"
              unoptimized={season.posterUrl.startsWith("http")}
            />
          </div>
        ) : (
          <div className="cv-sea season__posterWrap bg-[#1a1a1a]" />
        )}
        <div className="cv-sea season__meta">
          <div className="cv-sea season__top">
            <h2 className="cv-sea season__title">
              Staffel {season.seasonNumber}
            </h2>
            <div className="cv-sea season__chevron" aria-hidden>
              ▾
            </div>
          </div>
          <div className="cv-sea season__facts">
            {epCount > 0 && <span>{epCount} Folgen</span>}
            {airYear && <span>ab {airYear}</span>}
          </div>
          {season.overview && (
            <p className="cv-sea season__overview">{season.overview}</p>
          )}
        </div>
      </div>
      <ul
        className="cv-sea season__episodes"
        hidden={!open}
        aria-hidden={!open}
      >
        {season.episodes.map((ep) => (
          <EpisodeRow
            key={ep.id}
            episode={ep}
            canEdit={canEdit}
            onEdit={() => onEditEpisode(ep)}
          />
        ))}
      </ul>
    </section>
  );
}
