"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import type { SeriesDetailEpisode } from "@/lib/series-data";
import { ChecksumRow } from "@/components/movie/ChecksumRow";

type Props = {
  episode: SeriesDetailEpisode;
  canEdit: boolean;
  onEdit: () => void;
};

function formatAirDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function EpisodeRow({ episode, canEdit, onEdit }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (popoverOpen && popoverRef.current && !popoverRef.current.contains(target) && !target.closest(".cv-sea.info-btn")) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [popoverOpen]);

  const title = episode.title || `Episode ${episode.episodeNumber}`;
  const airDate = formatAirDate(episode.airDate);

  return (
    <li className="cv-sea episode-row" id={`ep-${episode.id}`}>
      <div className="cv-sea episode-row__wrap">
        {canEdit && (
          <>
            <button
              type="button"
              className="cv-sea info-btn"
              aria-label="Episoden-Infos"
              aria-expanded={popoverOpen}
              onClick={() => setPopoverOpen((o) => !o)}
            >
              ⓘ
            </button>
            <button
              type="button"
              className="cv-sea edit-btn"
              aria-label="Episode bearbeiten"
              onClick={onEdit}
            >
              ✎
            </button>
          </>
        )}
        {canEdit && (
          <div
            ref={popoverRef}
            className="cv-sea info-pop info-card"
            aria-hidden={!popoverOpen}
            role="region"
            aria-label="Encoding"
          >
            <h3>Encoding Folge {episode.episodeNumber}</h3>
            <ul>
              {episode.sizeBefore && (
                <li>
                  <span>Dateigröße vorher</span>
                  <strong>{episode.sizeBefore}</strong>
                </li>
              )}
              {episode.sizeAfter && (
                <li>
                  <span>Dateigröße nachher</span>
                  <strong>{episode.sizeAfter}</strong>
                </li>
              )}
              {episode.savingsPct && (
                <li>
                  <span>Ersparnis</span>
                  <strong>{episode.savingsPct}</strong>
                </li>
              )}
              {episode.checkSum && (
                <ChecksumRow checkSum={episode.checkSum} />
              )}
            </ul>
          </div>
        )}
        <div className="cv-sea episode-row__still">
          {episode.stillUrl ? (
            <Image
              src={episode.stillUrl}
              alt={`Episode ${episode.episodeNumber} Still`}
              width={140}
              height={84}
              className="rounded-lg object-cover"
              unoptimized={episode.stillUrl.startsWith("http")}
            />
          ) : (
            <div className="h-[84px] w-[140px] rounded-lg bg-[#1a1a1a]" />
          )}
        </div>
        <div className="cv-sea episode-row__meta">
          <div className="cv-sea episode-row__headline">
            <span className="cv-sea episode-row__num">
              E{episode.episodeNumber}
            </span>
            <h3 className="cv-sea episode-row__title">{title}</h3>
          </div>
          <div className="cv-sea episode-row__facts">
            {episode.runtimeMin != null && (
              <span>{episode.runtimeMin} min</span>
            )}
            {airDate && <span>{airDate}</span>}
          </div>
          {episode.overview && (
            <p className="cv-sea episode-row__overview">{episode.overview}</p>
          )}
        </div>
      </div>
    </li>
  );
}
