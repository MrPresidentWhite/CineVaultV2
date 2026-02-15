import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { invalidateSeriesCache } from "@/lib/series-data";
import { validateSizeBeforeWhenSizeAfter } from "@/lib/movie-size-validation";

/**
 * POST /api/series/episode/[id]/update
 * Body: sizeBeforeBytes, sizeAfterBytes, checkSum, runtimeMin
 * Requires EDITOR role.
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

  if (typeof body.checkSum !== "undefined") {
    data.checkSum = String(body.checkSum || "").toLowerCase() || null;
  }
  if (body.runtimeMin !== undefined && body.runtimeMin !== "") {
    data.runtimeMin = Number(body.runtimeMin) || null;
  } else if (body.runtimeMin === "") {
    data.runtimeMin = null;
  }
  if (body.sizeBeforeBytes !== undefined && body.sizeBeforeBytes !== "") {
    data.sizeBeforeBytes = BigInt(Number(body.sizeBeforeBytes));
  } else if (body.sizeBeforeBytes === "") {
    data.sizeBeforeBytes = null;
  }
  if (body.sizeAfterBytes !== undefined && body.sizeAfterBytes !== "") {
    data.sizeAfterBytes = BigInt(Number(body.sizeAfterBytes));
  } else if (body.sizeAfterBytes === "") {
    data.sizeAfterBytes = null;
  }

  const existing = await prisma.episode.findUnique({
    where: { id: idNum },
    select: { seriesId: true, sizeBeforeBytes: true, sizeAfterBytes: true },
  });
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Episode nicht gefunden" },
      { status: 404 }
    );
  }

  const effSizeAfter: bigint | null =
    data.sizeAfterBytes !== undefined
      ? (data.sizeAfterBytes as bigint)
      : existing.sizeAfterBytes;
  const effSizeBefore: bigint | null =
    data.sizeBeforeBytes !== undefined
      ? (data.sizeBeforeBytes as bigint)
      : existing.sizeBeforeBytes;

  const sizeValidationError = validateSizeBeforeWhenSizeAfter(
    effSizeAfter,
    effSizeBefore
  );
  if (sizeValidationError) {
    return NextResponse.json(
      { ok: false, error: sizeValidationError },
      { status: 400 }
    );
  }

  try {
    await prisma.episode.update({
      where: { id: idNum },
      data: data as never,
    });
    await invalidateSeriesCache(existing.seriesId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("episode update failed:", e);
    return NextResponse.json(
      { ok: false, error: "Update fehlgeschlagen" },
      { status: 500 }
    );
  }
}
