import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSessionIdFromCookie, updateSession } from "@/lib/session";
import { getCsrfTokenFromRequest, requireCsrf, generateCsrfToken } from "@/lib/csrf";

const MIN_NAME_LENGTH = 2;

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiges JSON" }, { status: 400 });
  }

  const csrfToken = getCsrfTokenFromRequest(request, body);
  const csrfError = requireCsrf(auth.session, csrfToken);
  if (csrfError) {
    return NextResponse.json({ ok: false, error: csrfError }, { status: 403 });
  }

  const name = String(body.name ?? "").trim();
  if (name.length < MIN_NAME_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Name muss mindestens ${MIN_NAME_LENGTH} Zeichen haben` },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { name },
  });

  const sid = await getSessionIdFromCookie();
  let newCsrfToken: string | undefined;
  if (sid) {
    newCsrfToken = generateCsrfToken();
    await updateSession(sid, { ...auth.session, csrfToken: newCsrfToken });
  }

  return NextResponse.json({
    ok: true,
    ...(newCsrfToken && { csrfToken: newCsrfToken }),
  });
}
