import Link from "next/link";
import Image from "next/image";
import type { HomeMovie } from "@/lib/home-data";
import { HoverPreview } from "./HoverPreview";
import { MovieHoverPanel } from "./MovieHoverPanel";

const isAvailable = (status: string) =>
  status === "UPLOADED" || status === "ARCHIVED";

export function MovieCard({ m }: { m: HomeMovie }) {
  const accent = m.accentColor ?? "#FFD700";
  const available = isAvailable(m.status);

  return (
    <HoverPreview panel={<MovieHoverPanel m={m} />} delaySec={0.8}>
      <Link
        href={`/movies/${m.id}`}
        className="card relative block overflow-hidden rounded-[14px] border-2 border-[#111] bg-[#101010] text-inherit no-underline transition-[transform,box-shadow,border-color] duration-[120ms] will-change-transform hover:-translate-y-0.5 hover:border-accent"
        style={{ ["--accent" as string]: accent }}
        aria-label={m.title}
      >
      {m.posterUrl ? (
        <Image
          src={m.posterUrl}
          alt={m.title}
          width={170}
          height={255}
          className="aspect-[2/3] w-full object-cover"
          sizes="(max-width: 639px) 50vw, (min-width: 1280px) 170px, 150px"
          unoptimized={m.posterUrl.startsWith("http")}
        />
      ) : (
        <div className="aspect-[2/3] w-full bg-[#1a1a1a]" />
      )}
      {available && (
        <div className="status-available" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width={30}
            height={30}
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
      <div className="title-overlay absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5">
        <span className="block truncate text-[13px] font-semibold text-white">
          {m.title}
        </span>
        {m.releaseYear != null && (
          <span className="text-xs text-white/80">{m.releaseYear}</span>
        )}
      </div>
    </Link>
    </HoverPreview>
  );
}
