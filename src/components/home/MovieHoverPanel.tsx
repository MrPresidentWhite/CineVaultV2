import Link from "next/link";
import Image from "next/image";
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

  return (
    <>
      <div className="cvh-banner relative">
        {m.backdropUrl ? (
          <Image
            src={m.backdropUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 1280px) 400px, 280px"
            unoptimized={m.backdropUrl.startsWith("http")}
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
      </div>
    </>
  );
}
