import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum, Status as StatusEnum } from "@/generated/prisma/enums";
import { invalidateMovieCache, invalidateMoviesListCache } from "@/lib/movie-data";
import { invalidateHomeCache } from "@/lib/home-data";

/**
 * POST /api/movies/[id]/update
 * Body: quality, mediaType, status, statusScheduledAt (nur bei status VO_SOON), priority, sizeBeforeBytes, sizeAfterBytes,
 * vbSentAt, vbReceivedAt, videobusterUrl, checkSum, assignedToUserId
 * Erfordert EDITOR.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ ok: false, error: "Ungültige ID" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiges JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.quality === "string") data.quality = body.quality.trim() || null;
  if (body.mediaType && typeof body.mediaType === "string") data.mediaType = body.mediaType;
  if (body.status && typeof body.status === "string") data.status = body.status;
  if (body.priority && typeof body.priority === "string") data.priority = body.priority;
  if (typeof body.videobusterUrl !== "undefined") data.videobusterUrl = body.videobusterUrl || null;
  if (typeof body.checkSum !== "undefined") data.checkSum = String(body.checkSum || "").toLowerCase() || null;
  if (body.assignedToUserId != null) data.assignedToUserId = Number(body.assignedToUserId) || null;

  if (body.sizeBeforeBytes !== undefined && body.sizeBeforeBytes !== "") {
    data.sizeBeforeBytes = BigInt(Number(body.sizeBeforeBytes));
  }
  if (body.sizeAfterBytes !== undefined && body.sizeAfterBytes !== "") {
    data.sizeAfterBytes = BigInt(Number(body.sizeAfterBytes));
  }

  const existing = await prisma.movie.findUnique({
    where: { id: idNum },
    select: {
      status: true,
      statusScheduledAt: true,
      checkSum: true,
      sizeBeforeBytes: true,
      sizeAfterBytes: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Film nicht gefunden" }, { status: 404 });
  }

  const effCheckSum =
    data.checkSum !== undefined
      ? (data.checkSum as string | null)
      : existing.checkSum;
  const effSizeAfter: bigint | null =
    data.sizeAfterBytes !== undefined
      ? (data.sizeAfterBytes as bigint)
      : existing.sizeAfterBytes;
  const effSizeBefore: bigint | null =
    data.sizeBeforeBytes !== undefined
      ? (data.sizeBeforeBytes as bigint)
      : existing.sizeBeforeBytes;

  if (
    effSizeAfter != null &&
    effSizeAfter > BigInt(0) &&
    (effSizeBefore == null || effSizeBefore <= BigInt(0))
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Wenn „Größe nachher“ ausgefüllt ist, muss auch „Größe vorher“ ausgefüllt sein.",
      },
      { status: 400 }
    );
  }

  if (
    existing.status !== StatusEnum.ARCHIVED &&
    effCheckSum &&
    effCheckSum.trim().length > 0 &&
    effSizeAfter != null &&
    effSizeAfter > BigInt(0)
  ) {
    data.status = StatusEnum.UPLOADED;
    data.statusScheduledAt = null;
  }

  const parseOptionalDate = (
    s: unknown,
    fieldLabel: string
  ): { date: Date | null; error?: string } => {
    if (s === undefined || s === null) return { date: null };
    if (typeof s !== "string") return { date: null, error: `${fieldLabel}: ungültiger Typ` };
    const trimmed = s.trim();
    if (trimmed === "") return { date: null };
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return { date: null, error: `${fieldLabel}: ungültiges Datum` };
    return { date: d };
  };

  if (body.vbSentAt !== undefined) {
    const result = parseOptionalDate(body.vbSentAt, "Ausgang (vbSentAt)");
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    data.vbSentAt = result.date;
  }
  if (body.vbReceivedAt !== undefined) {
    const result = parseOptionalDate(body.vbReceivedAt, "Eingang (vbReceivedAt)");
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    data.vbReceivedAt = result.date;
  }

  // statusScheduledAt: nur bei Status VO_SOON; sonst immer null
  const effectiveStatus =
    (data.status as string | undefined) ?? (typeof body.status === "string" ? body.status : undefined);
  if (effectiveStatus && effectiveStatus !== StatusEnum.VO_SOON) {
    data.statusScheduledAt = null;
  } else if (body.statusScheduledAt !== undefined) {
    const result = parseOptionalDate(body.statusScheduledAt, "VÖ-Datum (statusScheduledAt)");
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    data.statusScheduledAt = result.date;
  }

  const newStatus = effectiveStatus;
  const oldMovie: { status: string; statusScheduledAt: Date | null } = {
    status: existing.status,
    statusScheduledAt: existing.statusScheduledAt,
  };

  try {
    await prisma.movie.update({ where: { id: idNum }, data: data as never });

    if (oldMovie && newStatus && oldMovie.status !== newStatus) {
      await prisma.movieStatusChange.create({
        data: {
          movieId: idNum,
          from: oldMovie.status as (typeof StatusEnum)[keyof typeof StatusEnum],
          to: newStatus as (typeof StatusEnum)[keyof typeof StatusEnum],
          changedBy: auth.user.id,
          fromScheduledAt:
            oldMovie.status === StatusEnum.VO_SOON ? oldMovie.statusScheduledAt : null,
        },
      });
    }

    await Promise.all([
      invalidateMovieCache(idNum),
      invalidateMoviesListCache(),
      invalidateHomeCache(),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("movie update failed:", e);
    return NextResponse.json(
      { ok: false, error: "Update fehlgeschlagen" },
      { status: 500 }
    );
  }
}
