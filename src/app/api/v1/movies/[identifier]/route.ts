import { NextResponse } from "next/server";
import { getApiSessionFromRequest } from "@/lib/api-session";
import { prisma } from "@/lib/db";
import { toPublicUrl } from "@/lib/storage";
import { Status as StatusEnum } from "@/generated/prisma/enums";

const VALID_STATUSES = Object.values(StatusEnum) as string[];

/**
 * GET /api/v1/movies/[identifier]
 * Liefert einen Film per ID (Zahl) oder Checksum (String).
 * Erfordert API-Session (Challenge-Response-Auth).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ identifier: string }> }
) {
  const session = await getApiSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json(
      { error: "Nicht authentifiziert. Bitte zuerst Challenge-Response durchführen." },
      { status: 401 }
    );
  }

  const { identifier } = await context.params;
  const trimmed = identifier?.trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "identifier fehlt (ID oder Checksum)" },
      { status: 400 }
    );
  }

  const isNumericId = /^\d+$/.test(trimmed);
  const movie = isNumericId
    ? await prisma.movie.findUnique({
        where: { id: parseInt(trimmed, 10) },
        include: { genres: true },
      })
    : await prisma.movie.findFirst({
        where: { checkSum: trimmed },
        include: { genres: true },
      });

  if (!movie) {
    return NextResponse.json(
      { error: "Film nicht gefunden" },
      { status: 404 }
    );
  }

  return NextResponse.json(movieToResponse(movie));
}

function movieToResponse(movie: {
  id: number;
  title: string;
  releaseYear: number;
  runtimeMin: number;
  posterUrl: string | null;
  backdropUrl: string | null;
  accentColor: string | null;
  accentColorBackdrop: string | null;
  tmdbId: number | null;
  tagline: string | null;
  overview: string | null;
  status: string;
  priority: string;
  quality: string | null;
  mediaType: string | null;
  fsk: number | null;
  checkSum: string | null;
  sizeBeforeBytes: bigint | null;
  sizeAfterBytes: bigint | null;
  vbSentAt: Date | null;
  vbReceivedAt: Date | null;
  videobusterUrl: string | null;
  addedAt: Date;
  collectionId: number | null;
  genres: { genre: string }[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: movie.id,
    title: movie.title,
    releaseYear: movie.releaseYear,
    runtimeMin: movie.runtimeMin,
    posterUrl: toPublicUrl(movie.posterUrl) ?? movie.posterUrl,
    backdropUrl: toPublicUrl(movie.backdropUrl) ?? movie.backdropUrl,
    accentColor: movie.accentColor,
    accentColorBackdrop: movie.accentColorBackdrop,
    tmdbId: movie.tmdbId,
    tagline: movie.tagline,
    overview: movie.overview,
    status: movie.status,
    priority: movie.priority,
    quality: movie.quality,
    mediaType: movie.mediaType,
    fsk: movie.fsk,
    checkSum: movie.checkSum,
    sizeBeforeBytes: movie.sizeBeforeBytes != null ? String(movie.sizeBeforeBytes) : null,
    sizeAfterBytes: movie.sizeAfterBytes != null ? String(movie.sizeAfterBytes) : null,
    vbSentAt: movie.vbSentAt?.toISOString() ?? null,
    vbReceivedAt: movie.vbReceivedAt?.toISOString() ?? null,
    videobusterUrl: movie.videobusterUrl,
    addedAt: movie.addedAt.toISOString(),
    collectionId: movie.collectionId,
    genres: movie.genres.map((g) => g.genre),
    createdAt: movie.createdAt.toISOString(),
    updatedAt: movie.updatedAt.toISOString(),
  };
}

/**
 * PATCH /api/v1/movies/[identifier]
 * Aktualisiert nur den Status eines Films (ID oder Checksum).
 * Erfordert API-Session (Challenge-Response-Auth).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ identifier: string }> }
) {
  const session = await getApiSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Nicht authentifiziert. Bitte zuerst Challenge-Response durchführen." },
      { status: 401 }
    );
  }

  const { identifier } = await context.params;
  const trimmed = identifier?.trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "identifier fehlt (ID oder Checksum)" },
      { status: 400 }
    );
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiges JSON" },
      { status: 400 }
    );
  }

  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!status) {
    return NextResponse.json(
      { error: "status fehlt im Body" },
      { status: 400 }
    );
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      {
        error: `Ungültiger status. Erlaubt: ${VALID_STATUSES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const isNumericId = /^\d+$/.test(trimmed);
  const existing = isNumericId
    ? await prisma.movie.findUnique({
        where: { id: parseInt(trimmed, 10) },
        include: { genres: true },
      })
    : await prisma.movie.findFirst({
        where: { checkSum: trimmed },
        include: { genres: true },
      });

  if (!existing) {
    return NextResponse.json(
      { error: "Film nicht gefunden" },
      { status: 404 }
    );
  }

  const updated = await prisma.movie.update({
    where: { id: existing.id },
    data: { status: status as (typeof StatusEnum)[keyof typeof StatusEnum] },
    include: { genres: true },
  });

  return NextResponse.json(movieToResponse(updated));
}
