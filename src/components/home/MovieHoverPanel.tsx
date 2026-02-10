"use client";

import Link from "next/link";
import { useState } from "react";
import { SkeletonImage } from "@/components/ui/SkeletonImage";
import type { HomeMovie } from "@/lib/home-data";
import { makeBlurb } from "@/lib/blurb";

const isAvailable = (status: string) =>
  status === "UPLOADED" || status === "ARCHIVED";

function fmtRuntime(min: number | null): string | null {
  return typeof min === "number" && min > 0 ? `${min} min` : null;
}

export function MovieHoverPanel({ m }: { m: HomeMovie }) {
  const accent = m.accentColor ?? "#FFD700";
  const available = isAvailable(m.status);
  const blurb = makeBlurb(m.overview, { maxWords: 28, maxChars: 160 });
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <>
      <div className="cvh-banner relative">
        {m.backdropUrl ? (
          <SkeletonImage
            src={m.backdropUrl}
            alt=""
            fill
            className="object-cover"
            containerClassName="absolute inset-0"
            sizes="(min-width: 1280px) 400px, 280px"
            unoptimized={m.backdropUrl.startsWith("http")}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}
        {available && (
          <div className="status-available status-available--panel" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width={28}
              height={28}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" fill="#15a538" opacity={0.95} />
              <path d="M8 12 l3 3 l5 -6" stroke="#fff" strokeWidth={2} />
            </svg>
          </div>
        )}
      </div>
      <div
        className="cvh-content"
        style={{ ["--accent" as string]: accent }}
      >
        {imageLoaded ? (
          <>
            <div className="cvh-title">{m.title}</div>
            <div className="cvh-meta">
              {m.releaseYear != null && <span>{m.releaseYear}</span>}
              {m.runtimeMin != null && (
                <span>• {fmtRuntime(m.runtimeMin)}</span>
              )}
              {m.fsk != null && <span>• FSK {m.fsk}</span>}
            </div>
            {blurb && <p className="cvh-overview">{blurb}</p>}
            <div className="cvh-actions">
              <Link
                className="cvh-btn"
                href={`/movies/${m.id}`}
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
              <div className="h-[12px] w-1/5 rounded bg-neutral-800/50 animate-pulse" />
            </div>
            <div className="mb-3 space-y-1">
              <div className="h-[10px] w-full rounded bg-neutral-800/70 animate-pulse" />
              <div className="h-[10px] w-11/12 rounded bg-neutral-800/60 animate-pulse" />
              <div className="h-[10px] w-4/5 rounded bg-neutral-800/50 animate-pulse" />
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
