/**
 * Bereinigt Collections:
 * - Collections, deren TMDb-Collection gelöscht wurde (404/leer),
 * - Einzelfilm-Collections, deren Film laut TMDb keine Collection (mehr) hat.
 *
 * Aufruf aus Projektroot:
 *   npm run db:clean-collections           # echte Änderungen
 *   npm run db:clean-collections -- --dry-run   # nur anzeigen, nichts schreiben
 */

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getCollectionDetails, getMovieDetails } from "../src/lib/tmdb";
import {
  deleteObject,
  NO_BACKDROP_KEY,
  NO_POSTER_KEY,
} from "../src/lib/storage";
import {
  invalidateCollectionCache,
  invalidateCollectionsListCache,
} from "../src/lib/collection-data";
import { invalidateHomeCache } from "../src/lib/home-data";

const isDryRun = process.argv.includes("--dry-run");

function isDeletableMediaKey(key: string | null | undefined): key is string {
  if (!key) return false;
  if (key === NO_POSTER_KEY || key === NO_BACKDROP_KEY) return false;
  if (/^https?:\/\//i.test(key)) return false;
  return true;
}

async function cleanCollectionsWithDeletedTmdb() {
  const collections = await prisma.collection.findMany({
    where: { tmdbId: { not: null } },
    select: {
      id: true,
      tmdbId: true,
      name: true,
      posterUrl: true,
      coverUrl: true,
      backdropUrl: true,
      movies: { select: { id: true, title: true } },
    },
    orderBy: { id: "asc" },
  });

  let detachedMovies = 0;
  let deletedCollections = 0;

  for (const coll of collections) {
    if (!coll.tmdbId) continue;
    const tmdbId = coll.tmdbId;

    let details: Awaited<ReturnType<typeof getCollectionDetails>> | null = null;
    try {
      details = await getCollectionDetails(tmdbId);
    } catch (e) {
      // Netzwerk-/TMDb-Fehler nur loggen; nicht abbrechen.
      console.error(
        `Collection #${coll.id} (${coll.name}) – Fehler beim Laden von TMDb ${tmdbId}:`,
        e instanceof Error ? e.message : e
      );
      continue;
    }

    if (details) continue; // Collection existiert noch bei TMDb

    console.log(
      `Collection #${coll.id} (${coll.name}) – TMDb-Collection ${tmdbId} existiert nicht mehr.`
    );

    if (coll.movies.length === 0) {
      const mediaKeys = [
        coll.posterUrl,
        coll.coverUrl,
        coll.backdropUrl,
      ].filter(isDeletableMediaKey);

      if (!isDryRun) {
        // Medien in R2 löschen (falls vorhanden)
        for (const key of mediaKeys) {
          try {
            await deleteObject(key);
          } catch (e) {
            console.error(
              `  → Fehler beim Löschen des R2-Objekts ${key}:`,
              e instanceof Error ? e.message : e
            );
          }
        }
        await prisma.collection.delete({ where: { id: coll.id } });
        await invalidateCollectionCache(coll.id);
      }
      console.log(
        `  → Collection gelöscht (keine Filme verknüpft)${isDryRun ? " [dry-run]" : ""}`
      );
      deletedCollections++;
      continue;
    }

    // Filme von der Collection lösen
    if (!isDryRun) {
      await prisma.movie.updateMany({
        where: { collectionId: coll.id },
        data: { collectionId: null },
      });
    }
    console.log(
      `  → ${coll.movies.length} Film(e) von Collection gelöst${isDryRun ? " [dry-run]" : ""}`
    );
    detachedMovies += coll.movies.length;

    // Collection löschen, nachdem alle Filme gelöst wurden
    const mediaKeys = [
      coll.posterUrl,
      coll.coverUrl,
      coll.backdropUrl,
    ].filter(isDeletableMediaKey);

    if (!isDryRun) {
      for (const key of mediaKeys) {
        try {
          await deleteObject(key);
        } catch (e) {
          console.error(
            `  → Fehler beim Löschen des R2-Objekts ${key}:`,
            e instanceof Error ? e.message : e
          );
        }
      }
      await prisma.collection.delete({ where: { id: coll.id } });
      await invalidateCollectionCache(coll.id);
    }
    console.log(`  → Collection gelöscht${isDryRun ? " [dry-run]" : ""}`);
    deletedCollections++;
  }

  return { detachedMovies, deletedCollections };
}

async function cleanSingleMovieCollectionsWithoutTmdbCollection() {
  const collections = await prisma.collection.findMany({
    select: {
      id: true,
      name: true,
      tmdbId: true,
      posterUrl: true,
      coverUrl: true,
      backdropUrl: true,
      movies: {
        select: { id: true, title: true, tmdbId: true },
      },
    },
    orderBy: { id: "asc" },
  });

  let detachedMovies = 0;
  let deletedCollections = 0;

  for (const coll of collections) {
    if (coll.movies.length !== 1) continue;
    const movie = coll.movies[0];
    if (!movie.tmdbId) continue;

    let details: Awaited<ReturnType<typeof getMovieDetails>> | null = null;
    try {
      details = await getMovieDetails(movie.tmdbId);
    } catch (e) {
      console.error(
        `Collection #${coll.id} (${coll.name}) – Fehler beim Laden des Films ${movie.tmdbId}:`,
        e instanceof Error ? e.message : e
      );
      continue;
    }

    const belongsTo = details?.belongs_to_collection ?? null;

    // Film hat laut TMDb keine Collection (mehr) → Einzelfilm
    if (!belongsTo) {
      console.log(
        `Collection #${coll.id} (${coll.name}) nur für "${movie.title}", aber TMDb-Collection fehlt.`
      );
      if (!isDryRun) {
        await prisma.movie.update({
          where: { id: movie.id },
          data: { collectionId: null },
        });
      }
      console.log(
        `  → Film von Collection gelöst${isDryRun ? " [dry-run]" : ""}`
      );
      detachedMovies++;

      const mediaKeys = [
        coll.posterUrl,
        coll.coverUrl,
        coll.backdropUrl,
      ].filter(isDeletableMediaKey);

      if (!isDryRun) {
        for (const key of mediaKeys) {
          try {
            await deleteObject(key);
          } catch (e) {
            console.error(
              `  → Fehler beim Löschen des R2-Objekts ${key}:`,
              e instanceof Error ? e.message : e
            );
          }
        }
        await prisma.collection.delete({ where: { id: coll.id } });
        await invalidateCollectionCache(coll.id);
      }
      console.log(`  → Collection gelöscht${isDryRun ? " [dry-run]" : ""}`);
      deletedCollections++;
    }
  }

  return { detachedMovies, deletedCollections };
}

async function main() {
  console.log(
    `Starte Collection-Cleanup (${isDryRun ? "dry-run" : "live"}) …\n`
  );

  const res1 = await cleanCollectionsWithDeletedTmdb();
  const res2 = await cleanSingleMovieCollectionsWithoutTmdbCollection();

  console.log("\n--- Zusammenfassung ---");
  console.log(
    `TMDb-Collection gelöscht: ${res1.detachedMovies} Film(e) gelöst, ${res1.deletedCollections} Collection(s) gelöscht.`
  );
  console.log(
    `Einzelfilm ohne TMDb-Collection: ${res2.detachedMovies} Film(e) gelöst, ${res2.deletedCollections} Collection(s) gelöscht.`
  );

  if (isDryRun) {
    console.log(
      "\nHinweis: dry-run – es wurden keine Änderungen in der Datenbank oder in R2 geschrieben."
    );
  } else if (res1.deletedCollections + res2.deletedCollections > 0) {
    // Nach Änderungen an Collections: Listen- und Home-Cache invalidieren.
    await Promise.all([
      invalidateCollectionsListCache(),
      invalidateHomeCache(),
    ]);
    console.log(
      "\nCollection-Caches und Home-Cache wurden invalidiert (nach Cleanup)."
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Script fehlgeschlagen:", e);
    process.exit(1);
  });

