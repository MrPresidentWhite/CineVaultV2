import Link from "next/link";
import Image from "next/image";
import type { HomeCollection } from "@/lib/home-data";
import { makeBlurb } from "@/lib/blurb";

export function CollectionHoverPanel({ c }: { c: HomeCollection }) {
  const accent = c.accentColor ?? "#FFD700";
  const blurb = makeBlurb(
    (c.overview && c.overview.trim()) ? c.overview : null,
    { maxWords: 20, maxChars: 100 }
  );
  const bannerUrl = c.coverUrl ?? null;

  return (
    <>
      <div className="cvh-banner relative">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 1280px) 400px, 320px"
            unoptimized={bannerUrl.startsWith("http")}
          />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}
      </div>
      <div
        className="cvh-content"
        style={{ ["--accent" as string]: accent }}
      >
        <div className="cvh-title">{c.name}</div>
        <div className="cvh-meta">
          <span>{c.movieCount} {c.movieCount === 1 ? "Film" : "Filme"}</span>
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
      </div>
    </>
  );
}
