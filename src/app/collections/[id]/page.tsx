import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getCollectionById } from "@/lib/collection-data";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { CollectionHero } from "@/components/collection/CollectionHero";
import { Section } from "@/components/home/Section";
import { MovieCard } from "@/components/home/MovieCard";
import type { CollectionDetailMovie } from "@/lib/collection-data";
import type { HomeMovie } from "@/lib/home-data";

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

/** CollectionDetailMovie → HomeMovie für MovieCard (kompatibel). */
function toHomeMovie(m: CollectionDetailMovie): HomeMovie {
  return {
    id: m.id,
    title: m.title,
    releaseYear: m.releaseYear,
    runtimeMin: m.runtimeMin,
    fsk: m.fsk,
    accentColor: m.accentColor,
    posterUrl: m.posterUrl,
    backdropUrl: m.backdropUrl,
    tagline: m.tagline,
    overview: m.overview,
    status: m.status,
  };
}

export default async function CollectionDetailPage({ params }: Props) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) notFound();

  const [collection, auth] = await Promise.all([
    getCollectionById(idNum),
    getAuth(),
  ]);
  if (!collection) notFound();

  const canEdit = auth ? hasEffectiveRole(auth, RoleEnum.EDITOR) : false;

  const cookieStore = await cookies();
  const backUrlCookie = cookieStore.get("backUrl")?.value;
  const backUrl =
    backUrlCookie && !backUrlCookie.startsWith("http") ? backUrlCookie : "/";

  return (
    <>
      <CollectionHero
        collection={collection}
        backUrl={backUrl}
        canEdit={canEdit}
      />
      <Section title="Teile der Collection" href="/collections">
        <div className="cards cards--movies">
          {collection.movies.map((m) => (
            <MovieCard key={m.id} m={toHomeMovie(m)} />
          ))}
        </div>
      </Section>
    </>
  );
}
