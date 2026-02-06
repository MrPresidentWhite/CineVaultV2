import Link from "next/link";
import Image from "next/image";
import type { CollectionDetail } from "@/lib/collection-data";
import { CollectionHeroActions } from "./CollectionHeroActions";
import { OverviewToggle } from "./OverviewToggle";

type Props = {
  collection: CollectionDetail;
  backUrl: string;
  canEdit: boolean;
};

const accentVar = (c: CollectionDetail) =>
  c.accentColorBackdrop ?? c.accentColor ?? "#FFD700";

export function CollectionHero({
  collection,
  backUrl,
  canEdit,
}: Props) {
  const accent = accentVar(collection);
  const bgUrl = collection.backdropUrl ?? collection.coverUrl;

  return (
    <section
      className="collection-hero hero--accent"
      style={{ ["--accent" as string]: accent }}
    >
      {bgUrl && (
        <div className="absolute inset-0">
          <Image
            src={bgUrl}
            alt=""
            fill
            className="collection-hero__bg object-cover"
            sizes="100vw"
            priority
            unoptimized={bgUrl.startsWith("http")}
          />
        </div>
      )}
      <div className="collection-hero__overlay" aria-hidden />

      <CollectionHeroActions
        collectionId={collection.id}
        canEdit={canEdit}
      />

      <div className="collection-hero__content">
        <div className="collection-hero__poster">
          {collection.posterUrl ? (
            <Image
              src={collection.posterUrl}
              alt={collection.name}
              width={180}
              height={270}
              className="rounded-xl object-cover shadow-lg"
              unoptimized={collection.posterUrl.startsWith("http")}
            />
          ) : (
            <div className="h-[270px] w-[180px] rounded-xl bg-[#1a1a1a]" />
          )}
        </div>
        <div className="collection-hero__meta">
          <h1 className="collection-title">{collection.name}</h1>
          <p className="collection-count">
            {collection.movies.length} Filme
          </p>
          {collection.overview && (
            <OverviewToggle
              overview={collection.overview}
              className="collection-overview"
            />
          )}
          <div className="hero-actions">
            <Link href={backUrl} className="btn">
              Zurück
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
