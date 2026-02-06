"use client";

import { useState } from "react";
import type { SeriesDetail, SeriesDetailSeason } from "@/lib/series-data";
import { SeasonBlock } from "./SeasonBlock";
import { EpisodeEditModal } from "./EpisodeEditModal";
import type { SeriesDetailEpisode } from "@/lib/series-data";

type Props = { series: SeriesDetail; canEdit: boolean };

export function SeriesSeasons({ series, canEdit }: Props) {
  const [editingEpisode, setEditingEpisode] =
    useState<SeriesDetailEpisode | null>(null);

  return (
    <>
      <section className="cv-sea seasons">
        {series.seasons.map((season) => (
          <SeasonBlock
            key={season.id}
            season={season}
            seriesAccent={series.accentColor ?? "#FFD700"}
            canEdit={canEdit}
            onEditEpisode={setEditingEpisode}
          />
        ))}
      </section>
      {canEdit && editingEpisode && (
        <EpisodeEditModal
          episode={editingEpisode}
          onClose={() => setEditingEpisode(null)}
        />
      )}
    </>
  );
}
