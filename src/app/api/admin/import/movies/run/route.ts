import { NextResponse } from "next/server";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import {
  Role as RoleEnum,
  Status as StatusEnum,
  Priority as PriorityEnum,
  MediaType as MediaTypeEnum,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getMovieDetails, getMovieReleaseInfo } from "@/lib/tmdb";
import {
  ensureTmdbCached,
  getObjectAsBuffer,
  NO_POSTER_KEY,
  NO_BACKDROP_KEY,
} from "@/lib/storage";
import { getAccentFromBuffer } from "@/lib/accent";
import { mapTmdbGenresToEnum } from "@/lib/tmdb-genres";

function mapDeCertificationToFsk(cert?: string | null): number | null {
  if (!cert) return null;
  const n = parseInt(cert, 10);
  if ([0, 6, 12, 16, 18].includes(n)) return n;
  return null;
}

async function getFskFromTmdbMovie(tmdbMovieId: number): Promise<number | null> {
  try {
    const rel = await getMovieReleaseInfo(tmdbMovieId);
    const de = rel.results.find((r) => r.iso_3166_1 === "DE");
    if (!de) return null;
    const preferred =
      de.release_dates.find((x) => x.certification?.trim()) ??
      de.release_dates[0];
    return mapDeCertificationToFsk(preferred?.certification);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  let body: {
    tmdbId?: number;
    status?: string;
    priority?: string;
    mediaType?: string;
    quality?: string;
    assignedToUserId?: number;
    sizeBeforeBytes?: string;
    sizeAfterBytes?: string;
    videobusterUrl?: string;
    movies?: {
      tmdbId: number;
      status?: string;
      priority?: string;
      mediaType?: string;
      quality?: string;
      assignedToUserId?: number;
      sizeBeforeBytes?: string;
      sizeAfterBytes?: string;
      videobusterUrl?: string;
    }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Request-Body" },
      { status: 400 }
    );
  }

  type ProgressCallback = (progress: number, message: string) => void;

  async function importOneMovie(
    single: {
      tmdbId: number;
      status?: string;
      priority?: string;
      mediaType?: string;
      quality?: string;
      assignedToUserId?: number;
      sizeBeforeBytes?: string;
      sizeAfterBytes?: string;
      videobusterUrl?: string;
    },
    onProgress?: ProgressCallback
  ): Promise<{ id: number; title: string }> {
    const tmdbIdLocal = Number(single.tmdbId);
    if (!Number.isFinite(tmdbIdLocal) || tmdbIdLocal <= 0) {
      throw new Error("Ungültige TMDb-ID im Import-Payload");
    }

    const existing = await prisma.movie.findFirst({
      where: { tmdbId: tmdbIdLocal },
      select: { id: true, title: true },
    });
    if (existing) {
      onProgress?.(100, "Bereits vorhanden.");
      return { id: existing.id, title: existing.title };
    }

    onProgress?.(0, "Lade TMDb-Details …");
    const d = await getMovieDetails(tmdbIdLocal);
    if (!d) {
      throw new Error("TMDb-Details nicht gefunden");
    }

    const year = d.release_date
      ? new Date(d.release_date).getFullYear()
      : new Date().getFullYear();

    onProgress?.(25, "Lade Poster (TMDb → R2) …");
    const posterKey = d.poster_path
      ? await ensureTmdbCached({ filePath: d.poster_path, size: "w500" }).catch(
          () => NO_POSTER_KEY
        )
      : NO_POSTER_KEY;

    onProgress?.(50, "Lade Backdrop (TMDb → R2) …");
    const backdropKey = d.backdrop_path
      ? await ensureTmdbCached({ filePath: d.backdrop_path, size: "w780" }).catch(
          () => NO_BACKDROP_KEY
        )
      : NO_BACKDROP_KEY;

    onProgress?.(75, "Berechne Akzentfarben …");
    const [posterBuf, backdropBuf] = await Promise.all([
      posterKey ? getObjectAsBuffer(posterKey) : Promise.resolve(null),
      backdropKey ? getObjectAsBuffer(backdropKey) : Promise.resolve(null),
    ]);
    const accentColor = await getAccentFromBuffer(posterBuf);
    const accentColorBackdrop = await getAccentFromBuffer(backdropBuf);
    onProgress?.(80, "Speichere in Datenbank …");
    const fsk = await getFskFromTmdbMovie(d.id);

    const enumGenres = mapTmdbGenresToEnum(d.genres || []);

    // Neue Filme beim Import immer RECENTLY_ADDED (systemisch), danach Status-Change für Notifications
    const priority =
      (single.priority as keyof typeof PriorityEnum) || PriorityEnum.STANDARD;
    const mediaType =
      (single.mediaType as keyof typeof MediaTypeEnum) || MediaTypeEnum.BLURAY;

    const sizeBefore =
      single.sizeBeforeBytes && single.sizeBeforeBytes.trim()
        ? BigInt(single.sizeBeforeBytes.trim())
        : null;
    const sizeAfter =
      single.sizeAfterBytes && single.sizeAfterBytes.trim()
        ? BigInt(single.sizeAfterBytes.trim())
        : null;

    const assignedId =
      typeof single.assignedToUserId === "number" &&
      Number.isFinite(single.assignedToUserId)
        ? single.assignedToUserId
        : null;

    const created = await prisma.movie.create({
      data: {
        tmdbId: d.id,
        title: d.title,
        releaseYear: year,
        runtimeMin: d.runtime ?? 0,
        posterUrl: posterKey,
        backdropUrl: backdropKey,
        overview: d.overview ?? null,
        tagline: d.tagline ?? null,
        status: StatusEnum.RECENTLY_ADDED,
        priority,
        mediaType,
        quality: single.quality || null,
        sizeBeforeBytes: sizeBefore,
        sizeAfterBytes: sizeAfter,
        videobusterUrl: single.videobusterUrl || null,
        accentColor,
        accentColorBackdrop: backdropKey ? accentColorBackdrop : null,
        fsk,
        ...(assignedId
          ? { assignedToUser: { connect: { id: assignedId } } }
          : {}),
        ...(enumGenres.length
          ? {
              genres: {
                create: enumGenres.map((g) => ({
                  genre: g,
                })),
              },
            }
          : {}),
      },
      select: { id: true, title: true },
    });

    await prisma.movieStatusChange.create({
      data: {
        movieId: created.id,
        from: StatusEnum.ON_WATCHLIST,
        to: StatusEnum.RECENTLY_ADDED,
        changedBy: auth?.user?.id ?? null,
      },
    });

    onProgress?.(100, "Fertig.");
    return { id: created.id, title: created.title };
  }

  const streamProgress = request.headers.get("X-Stream-Progress") === "true";

  if (streamProgress) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        };
        try {
          if (Array.isArray(body.movies) && body.movies.length > 0) {
            const results: { id: number; title: string }[] = [];
            const total = body.movies.length;
            for (let i = 0; i < body.movies.length; i++) {
              const m = body.movies[i];
              const base = (i / total) * 100;
              const scale = 100 / total;
              const result = await importOneMovie(m, (p, msg) =>
                send({
                  progress: base + (p / 100) * scale,
                  message: `Film ${i + 1}/${total}: ${msg}`,
                })
              );
              results.push(result);
            }
            send({
              step: "done",
              ids: results.map((r) => r.id),
              titles: results.map((r) => r.title),
            });
          } else {
            const tmdbId = Number(body.tmdbId);
            if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
              send({ step: "error", error: "Ungültige TMDb-ID" });
              controller.close();
              return;
            }
            const result = await importOneMovie(body as any, (p, msg) =>
              send({ progress: p, message: msg })
            );
            send({ step: "done", id: result.id, title: result.title });
          }
        } catch (e) {
          console.error("Import movies/run error:", e);
          send({
            step: "error",
            error: e instanceof Error ? e.message : "Import fehlgeschlagen",
          });
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }

  try {
    // Collection-Bulk-Import (mehrere Filme)
    if (Array.isArray(body.movies) && body.movies.length > 0) {
      const importedIds: number[] = [];
      for (const m of body.movies) {
        const result = await importOneMovie(m);
        importedIds.push(result.id);
      }
      return NextResponse.json({ ok: true, ids: importedIds });
    }

    // Single-Import (Rückwärtskompatibilität)
    const tmdbId = Number(body.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Ungültige TMDb-ID" },
        { status: 400 }
      );
    }

    const result = await importOneMovie(body as any);
    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    console.error("Import movies/run error:", e);
    return NextResponse.json(
      { ok: false, error: "Import fehlgeschlagen" },
      { status: 500 }
    );
  }
}

