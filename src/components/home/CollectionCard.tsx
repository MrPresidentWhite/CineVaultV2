import Link from "next/link";
import Image from "next/image";
import type { HomeCollection } from "@/lib/home-data";
import { HoverPreview } from "./HoverPreview";
import { CollectionHoverPanel } from "./CollectionHoverPanel";

export function CollectionCard({ c }: { c: HomeCollection }) {
  const accent = c.accentColor ?? "#FFD700";

  return (
    <HoverPreview
      panel={<CollectionHoverPanel c={c} />}
      delaySec={0.8}
      panelClassName="cv-hover__panel--wide"
    >
      <Link
        href={`/collections/${c.id}`}
        className="card card--collection relative block overflow-hidden rounded-[14px] border-2 border-[#111] bg-[#101010] text-inherit no-underline transition-[transform,box-shadow,border-color] duration-[120ms] will-change-transform hover:-translate-y-0.5 hover:border-accent"
        style={{ ["--accent" as string]: accent }}
        aria-label={c.name}
      >
      {c.coverUrl ? (
        <Image
          src={c.coverUrl}
          alt={c.name}
          width={320}
          height={180}
          className="aspect-video w-full object-cover"
          sizes="(min-width: 1280px) 320px, 280px"
          unoptimized={c.coverUrl.startsWith("http")}
        />
      ) : (
        <div className="aspect-video w-full bg-[#1a1a1a]" />
      )}
      <div className="title-overlay absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5">
        <span className="block truncate text-[13px] font-semibold text-white">
          {c.name}
        </span>
        <span className="text-xs text-white/80">{c.movieCount} Filme</span>
      </div>
    </Link>
    </HoverPreview>
  );
}
