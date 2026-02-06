import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSessionIdFromCookie } from "@/lib/session";

/**
 * POST /api/profile/devices/[id]/revoke
 * Meldet eine Sitzung ab (nur eigene). Wenn es die aktuelle Sitzung ist → redirectToLogin.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  const { id: sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session-ID fehlt" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true, sid: true },
  });

  if (!session || session.userId !== auth.user.id) {
    return NextResponse.json({ ok: false, error: "Sitzung nicht gefunden" }, { status: 404 });
  }

  const currentSid = await getSessionIdFromCookie();
  const isCurrentSession = currentSid !== null && session.sid === currentSid;

  await prisma.session.delete({ where: { id: sessionId } });

  return NextResponse.json({
    ok: true,
    redirectToLogin: isCurrentSession,
  });
}
