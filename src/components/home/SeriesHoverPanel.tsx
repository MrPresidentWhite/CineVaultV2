"use client";

import Link from "next/link";
import { useState } from "react";
import { SkeletonImage } from "@/components/ui/SkeletonImage";
import type { HomeSeries } from "@/lib/home-data";
import { makeBlurb } from "@/lib/blurb";

export function SeriesHoverPanel({ s }: { s: HomeSeries }) {
  const accent = s.accentColor ?? "#FFD700";
  const blurb = makeBlurb(
    (s.tagline && s.tagline.trim()) ? s.tagline : s.overview ?? "",
    { maxWords: 12, maxChars: 45 }
  );
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <>
      <div className="cvh-banner relative">
        {s.backdropUrl ? (
          <SkeletonImage
            src={s.backdropUrl}
            alt=""
            fill
            className="object-cover"
            containerClassName="absolute inset-0"
            sizes="(min-width: 1280px) 400px, 280px"
            unoptimized={s.backdropUrl.startsWith("http")}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}
      </div>
      <div
        className="cvh-content"
        style={{ ["--accent" as string]: accent }}
      >
        {imageLoaded ? (
          <>
            <div className="cvh-title">{s.title}</div>
            <div className="cvh-meta">
              {s.firstAirYear != null && <span>{s.firstAirYear}</span>}
              {s.fsk != null && <span>• FSK {s.fsk}</span>}
            </div>
            {blurb && <p className="cvh-overview">{blurb}</p>}
            <div className="cvh-actions">
              <Link
                className="cvh-btn"
                href={`/series/${s.id}`}
                style={{ ["--accent" as string]: accent }}
              >
                Details
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 h-[18px] w-4/5 rounded bg-neutral-800/80 animate-pulse" />
            <div className="mb-2 flex gap-2">
              <div className="h-[12px] w-1/4 rounded bg-neutral-800/70 animate-pulse" />
              <div className="h-[12px] w-1/3 rounded bg-neutral-800/60 animate-pulse" />
            </div>
            <div className="mb-3 space-y-1">
              <div className="h-[10px] w-full rounded bg-neutral-800/70 animate-pulse" />
              <div className="h-[10px] w-10/12 rounded bg-neutral-800/60 animate-pulse" />
            </div>
            <div className="cvh-actions">
              <div className="h-[30px] w-24 rounded-full bg-neutral-800/80 animate-pulse" />
            </div>
          </>
        )}
      </div>
    </>
  );
}
