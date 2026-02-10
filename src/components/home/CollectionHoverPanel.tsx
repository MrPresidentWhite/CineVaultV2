"use client";

import Link from "next/link";
import { useState } from "react";
import { SkeletonImage } from "@/components/ui/SkeletonImage";
import type { HomeCollection } from "@/lib/home-data";
import { makeBlurb } from "@/lib/blurb";

export function CollectionHoverPanel({ c }: { c: HomeCollection }) {
  const accent = c.accentColor ?? "#FFD700";
  const blurb = makeBlurb(
    (c.overview && c.overview.trim()) ? c.overview : null,
    { maxWords: 20, maxChars: 100 }
  );
  const bannerUrl = c.coverUrl ?? null;
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <>
      <div className="cvh-banner relative">
        {bannerUrl ? (
          <SkeletonImage
            src={bannerUrl}
            alt=""
            fill
            className="object-cover"
            containerClassName="absolute inset-0"
            sizes="(min-width: 1280px) 400px, 320px"
            unoptimized={bannerUrl.startsWith("http")}
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
            <div className="cvh-title">{c.name}</div>
            <div className="cvh-meta">
              <span>
                {c.movieCount} {c.movieCount === 1 ? "Film" : "Filme"}
              </span>
            </div>
            {blurb && <p className="cvh-overview">{blurb}</p>}
            <div className="cvh-actions">
              <Link
                className="cvh-btn cvh-btn--primary"
                href={`/collections/${c.id}`}
                style={{ ["--accent" as string]: accent }}
              >
                Öffnen
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 h-[18px] w-4/5 rounded bg-neutral-800/80 animate-pulse" />
            <div className="mb-2 h-[12px] w-1/3 rounded bg-neutral-800/70 animate-pulse" />
            <div className="mb-3 space-y-1">
              <div className="h-[10px] w-full rounded bg-neutral-800/70 animate-pulse" />
              <div className="h-[10px] w-5/6 rounded bg-neutral-800/60 animate-pulse" />
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
