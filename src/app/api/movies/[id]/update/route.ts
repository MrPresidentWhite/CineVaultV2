import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { invalidateMovieCache, invalidateMoviesListCache } from "@/lib/movie-data";
import { invalidateHomeCache } from "@/lib/home-data";

/**
 * POST /api/movies/[id]/update
 * Body: quality, mediaType, status, priority, sizeBeforeBytes, sizeAfterBytes,
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

  const parseDate = (s: unknown) => (s && typeof s === "string" ? new Date(s) : null);
  if (body.vbSentAt !== undefined) data.vbSentAt = parseDate(body.vbSentAt);
  if (body.vbReceivedAt !== undefined) data.vbReceivedAt = parseDate(body.vbReceivedAt);

  try {
    await prisma.movie.update({ where: { id: idNum }, data: data as never });
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
