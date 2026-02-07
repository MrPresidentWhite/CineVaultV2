import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

/**
 * POST /api/admin/users/[id]/disable-2fa
 * Deaktiviert 2FA für den angegebenen Benutzer (z. B. wenn er sich nicht mehr einloggen kann).
 * Erfordert ADMIN.
 */
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
    select: { totpEnabledAt: true },
  });
  if (!target) {
    return NextResponse.json({ ok: false, error: "Benutzer nicht gefunden" }, { status: 404 });
  }
  if (!target.totpEnabledAt) {
    return NextResponse.json(
      { ok: false, error: "2FA ist für diesen Benutzer nicht aktiviert." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: idNum },
      data: { totpSecretEncrypted: null, totpEnabledAt: null },
    }),
    prisma.userBackupCode.deleteMany({ where: { userId: idNum } }),
    prisma.trustedDevice.deleteMany({ where: { userId: idNum } }),
  ]);

  return NextResponse.json({ ok: true });
}
