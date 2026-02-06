import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

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

  const target = await prisma.user.findUnique({
    where: { id: idNum },
    select: { isMasterAdmin: true, locked: true },
  });
  if (!target) {
    return NextResponse.json({ ok: false, error: "Benutzer nicht gefunden" }, { status: 404 });
  }
  if (target.isMasterAdmin) {
    return NextResponse.json(
      { ok: false, error: "Master-Admin kann nicht gesperrt werden." },
      { status: 403 }
    );
  }

  await prisma.user.update({
    where: { id: idNum },
    data: { locked: !target.locked },
  });

  return NextResponse.json({
    ok: true,
    locked: !target.locked,
  });
}
