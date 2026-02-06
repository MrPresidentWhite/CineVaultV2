import Link from "next/link";
import Image from "next/image";
import type { HomeSeries } from "@/lib/home-data";
import { makeBlurb } from "@/lib/blurb";

export function SeriesHoverPanel({ s }: { s: HomeSeries }) {
  const accent = s.accentColor ?? "#FFD700";
  const blurb = makeBlurb(
    (s.tagline && s.tagline.trim()) ? s.tagline : s.overview ?? "",
    { maxWords: 12, maxChars: 45 }
  );

  return (
    <>
      <div className="cvh-banner relative">
        {s.backdropUrl ? (
          <Image
            src={s.backdropUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 1280px) 400px, 280px"
            unoptimized={s.backdropUrl.startsWith("http")}
          />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}
      </div>
      <div
        className="cvh-content"
        style={{ ["--accent" as string]: accent }}
      >
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
      </div>
    </>
  );
}
