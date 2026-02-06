import { getHomeData } from "@/lib/home-data";
import { Section } from "@/components/home/Section";
import { CollectionCard } from "@/components/home/CollectionCard";
import { MovieCard } from "@/components/home/MovieCard";
import { SeriesCard } from "@/components/home/SeriesCard";

/** ISR: Seite und Daten alle 5 Min. neu validieren, dazwischen aus Cache. */
export const revalidate = 300;

export default async function HomePage() {
  const { collections, standalone, series } = await getHomeData();

  return (
    <>
      <Section title="Collections" href="/collections">
        <div className="cards cards--collections">
          {collections.map((c) => (
            <CollectionCard key={c.id} c={c} />
          ))}
        </div>
      </Section>

      <Section title="Filme" href="/movies">
        <div className="cards cards--movies">
          {standalone.map((m) => (
            <MovieCard key={m.id} m={m} />
          ))}
        </div>
      </Section>

      <Section title="Serien" href="/series">
        <div className="cards cards--movies">
          {series.map((s) => (
            <SeriesCard key={s.id} s={s} />
          ))}
        </div>
      </Section>
    </>
  );
}
