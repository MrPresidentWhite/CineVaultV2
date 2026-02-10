 "use client";

import Link from "next/link";
import { useState } from "react";
import { SkeletonImage } from "@/components/ui/SkeletonImage";
import type { HomeSeries } from "@/lib/home-data";
import { HoverPreview } from "./HoverPreview";
import { SeriesHoverPanel } from "./SeriesHoverPanel";

export function SeriesCard({ s }: { s: HomeSeries }) {
  const accent = s.accentColor ?? "#FFD700";
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <HoverPreview panel={<SeriesHoverPanel s={s} />} delaySec={0.8}>
      <Link
        href={`/series/${s.id}`}
        className="card relative block overflow-hidden rounded-[14px] border-2 border-[#111] bg-[#101010] text-inherit no-underline transition-[transform,box-shadow,border-color] duration-[120ms] will-change-transform hover:-translate-y-0.5 hover:border-accent"
        style={{ ["--accent" as string]: accent }}
        aria-label={s.title}
      >
        {s.posterUrl ? (
          <SkeletonImage
            src={s.posterUrl}
            alt={s.title}
            width={170}
            height={255}
            className="aspect-[2/3] w-full object-cover"
            sizes="(max-width: 639px) 50vw, (min-width: 1280px) 170px, 150px"
            unoptimized={s.posterUrl.startsWith("http")}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="aspect-[2/3] w-full bg-[#1a1a1a]" />
        )}
        <div className="title-overlay absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5">
          {imageLoaded ? (
            <>
              <span className="block truncate text-[13px] font-semibold text-white">
                {s.title}
              </span>
              {s.firstAirYear != null && (
                <span className="text-xs text-white/80">
                  {s.firstAirYear}
                </span>
              )}
            </>
          ) : (
            <>
              <div className="mb-1 h-[14px] w-3/4 rounded bg-neutral-800/80 animate-pulse" />
              <div className="h-[10px] w-1/3 rounded bg-neutral-800/60 animate-pulse" />
            </>
          )}
        </div>
    </Link>
    </HoverPreview>
  );
}
