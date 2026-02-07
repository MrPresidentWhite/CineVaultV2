import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

/**
 * GET /api/dashboard/security/2fa/status
 * Liefert ob 2FA aktiv ist. Erfordert eingeloggt + EDITOR.
 */
export async function GET() {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { totpEnabledAt: true },
  });

  return NextResponse.json({
    ok: true,
    enabled: !!user?.totpEnabledAt,
  });
}
