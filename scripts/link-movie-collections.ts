/**
 * Nachträgliches Mapping: Filme ohne Collection werden per TMDb
 * (belongs_to_collection) einer Collection zugeordnet. Legt fehlende
 * Collections an und verknüpft die Filme.
 *
 * Voraussetzung:
 * - .env mit DB und TMDb (und ggf. R2) konfiguriert
 * - Migration „add_collection_tmdb_id“ angewendet (npm run db:migrate bzw. db:migrate:deploy)
 *
 * Aufruf aus Projektroot: npm run db:link-collections
 * Oder: npx tsx scripts/link-movie-collections.ts
 *
 * Optional: --dry-run  → nur anzeigen, keine DB-Änderungen
 */

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getMovieDetails } from "../src/lib/tmdb";
import { getOrCreateCollectionByTmdbId } from "../src/lib/collection-tmdb";

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  // Prüfen, ob Collection.tmdbId existiert (Migration add_collection_tmdb_id)
  try {
    await prisma.collection.findFirst({ select: { tmdbId: true } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("tmdbId") || msg.includes("does not exist")) {
      console.error(
        "Fehler: Spalte Collection.tmdbId fehlt. Bitte zuerst Migration ausführen:\n  npm run db:migrate\n  bzw. im Deployment: npm run db:migrate:deploy\n"
      );
      process.exit(1);
    }
    throw e;
  }

  const candidates = await prisma.movie.findMany({
    where: {
      tmdbId: { not: null },
      collectionId: null,
    },
    select: { id: true, title: true, tmdbId: true },
    orderBy: { id: "asc" },
  });

  console.log(
    `\n${candidates.length} Film(e) ohne Collection gefunden (tmdbId vorhanden).\n`
  );
  if (candidates.length === 0) {
    console.log("Nichts zu tun.");
    return;
  }

  let linked = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < candidates.length; i++) {
    const movie = candidates[i];
    const tmdbId = movie.tmdbId!;
    const num = i + 1;
    const total = candidates.length;

    try {
      const d = await getMovieDetails(tmdbId);
      const collId = d?.belongs_to_collection?.id;

      if (!collId) {
        console.log(`[${num}/${total}] ${movie.title} – keine TMDb-Collection`);
        skipped++;
        continue;
      }

      const collectionId = await getOrCreateCollectionByTmdbId(collId);
      if (!collectionId) {
        console.log(
          `[${num}/${total}] ${movie.title} – Collection TMDb ${collId} konnte nicht geladen werden`
        );
        skipped++;
        continue;
      }

      if (!isDryRun) {
        await prisma.movie.update({
          where: { id: movie.id },
          data: { collectionId },
        });
      }

      console.log(
        `[${num}/${total}] ${movie.title} → Collection-ID ${collectionId}${isDryRun ? " (dry-run)" : ""}`
      );
      linked++;
    } catch (e) {
      console.error(
        `[${num}/${total}] ${movie.title} – Fehler:`,
        e instanceof Error ? e.message : e
      );
      errors++;
    }
  }

  console.log("\n---");
  console.log(
    `Verknüpft: ${linked}, Übersprungen: ${skipped}, Fehler: ${errors}`
  );
  if (isDryRun && linked > 0) {
    console.log("(Dry-run – keine Änderungen geschrieben.)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Script fehlgeschlagen:", e);
    process.exit(1);
  });
