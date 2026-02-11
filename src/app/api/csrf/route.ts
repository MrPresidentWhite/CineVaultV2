import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getSessionIdFromCookie, updateSession } from "@/lib/session";
import { generateCsrfToken } from "@/lib/csrf";

/**
 * GET /api/csrf
 * Liefert den CSRF-Token für die aktuelle Session (für sensible Formulare).
 * Erfordert eingeloggt. Token wird in der Session gespeichert und bei Bedarf neu erzeugt.
 */
export async function GET() {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  const sid = await getSessionIdFromCookie();
  if (!sid) {
    return NextResponse.json({ ok: false, error: "Keine Session" }, { status: 401 });
  }

  const session = auth.session;
  let token =
    typeof session.csrfToken === "string" ? session.csrfToken : null;
  if (!token) {
    token = generateCsrfToken();
    await updateSession(sid, { ...session, csrfToken: token });
  }

  return NextResponse.json({ ok: true, csrfToken: token });
}
