import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSessionIdFromCookie } from "@/lib/session";

/**
 * POST /api/profile/devices/revoke-all-others
 * Meldet alle anderen Sitzungen des Users ab (nur wo sid !== aktuelle sid).
 */
export async function POST() {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  const currentSid = await getSessionIdFromCookie();
  if (!currentSid) {
    return NextResponse.json({ ok: true, revoked: 0 });
  }

  const result = await prisma.session.deleteMany({
    where: {
      userId: auth.user.id,
      sid: { not: currentSid },
      expiresAt: { gt: new Date() },
    },
  });

  return NextResponse.json({ ok: true, revoked: result.count });
}
