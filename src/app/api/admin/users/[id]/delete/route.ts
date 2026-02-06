import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

async function guardMaster(targetUserId: number, actorUserId: number): Promise<boolean> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isMasterAdmin: true },
  });
  if (!target?.isMasterAdmin) return true;
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { isMasterAdmin: true },
  });
  return !!(actor?.isMasterAdmin && actorUserId === targetUserId);
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Ungültige ID" }, { status: 400 });
  }

  const allowed = await guardMaster(idNum, auth.user.id);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Master-Admin kann nicht gelöscht werden." },
      { status: 403 }
    );
  }

  await prisma.user.delete({ where: { id: idNum } });
  return NextResponse.json({ ok: true });
}
