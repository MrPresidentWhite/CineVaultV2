/**
 * GET /api/dashboard/security/passkeys
 * Returns list of user's passkeys. Requires auth.
 *
 * POST /api/dashboard/security/passkeys (not used for create - that's register/verify)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

export async function GET() {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId: auth.user.id },
    select: {
      id: true,
      name: true,
      deviceType: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    credentials,
  });
}
