/**
 * PATCH /api/dashboard/security/passkeys/[id]
 * Updates passkey name. Requires auth + CSRF.
 *
 * DELETE /api/dashboard/security/passkeys/[id]
 * Removes a passkey. Requires auth + CSRF.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getCsrfTokenFromRequest, requireCsrf, generateCsrfToken } from "@/lib/csrf";
import { updateSession } from "@/lib/session";
import { getSessionIdFromCookie } from "@/lib/session";

async function requireOwnCredential(
  id: string,
  userId: number
) {
  const credential = await prisma.webAuthnCredential.findFirst({
    where: { id, userId },
  });
  if (!credential) return null;
  return credential;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Body" },
      { status: 400 }
    );
  }

  const csrfToken = getCsrfTokenFromRequest(request, body);
  const csrfError = requireCsrf(auth.session, csrfToken);
  if (csrfError) {
    return NextResponse.json({ ok: false, error: csrfError }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID fehlt" },
      { status: 400 }
    );
  }

  const credential = await requireOwnCredential(id, auth.user.id);
  if (!credential) {
    return NextResponse.json(
      { ok: false, error: "Passkey nicht gefunden." },
      { status: 404 }
    );
  }

  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 191) || null : null;

  await prisma.webAuthnCredential.update({
    where: { id },
    data: { name },
  });

  const sid = await getSessionIdFromCookie();
  if (sid) {
    const newCsrfToken = generateCsrfToken();
    await updateSession(sid, { ...auth.session, csrfToken: newCsrfToken });
    return NextResponse.json({
      ok: true,
      name,
      csrfToken: newCsrfToken,
    });
  }
  return NextResponse.json({ ok: true, name });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  const csrfToken = getCsrfTokenFromRequest(request);
  const csrfError = requireCsrf(auth.session, csrfToken);
  if (csrfError) {
    return NextResponse.json({ ok: false, error: csrfError }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID fehlt" },
      { status: 400 }
    );
  }

  const credential = await requireOwnCredential(id, auth.user.id);
  if (!credential) {
    return NextResponse.json(
      { ok: false, error: "Passkey nicht gefunden." },
      { status: 404 }
    );
  }

  await prisma.webAuthnCredential.delete({
    where: { id },
  });

  const sid = await getSessionIdFromCookie();
  if (sid) {
    const newCsrfToken = generateCsrfToken();
    await updateSession(sid, { ...auth.session, csrfToken: newCsrfToken });
    return NextResponse.json({
      ok: true,
      csrfToken: newCsrfToken,
    });
  }

  return NextResponse.json({ ok: true });
}
