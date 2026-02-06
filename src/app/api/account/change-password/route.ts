import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { verifyPassword, hashPassword } from "@/lib/password";

/**
 * POST /api/account/change-password
 * Body: currentPassword?, newPassword, confirmPassword
 * Bei mustChangePassword kann currentPassword fehlen.
 */
export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiges JSON" }, { status: 400 });
  }

  const userId = auth.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, mustChangePassword: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const forced = !!user.mustChangePassword;
  if (!forced) {
    const ok = await verifyPassword(body.currentPassword ?? "", user.password);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Aktuelles Passwort ist falsch" }, { status: 400 });
    }
  }

  const newPassword = (body.newPassword ?? "").trim();
  if (newPassword.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Neues Passwort zu kurz (min. 6 Zeichen)" },
      { status: 400 }
    );
  }
  if (newPassword !== (body.confirmPassword ?? "").trim()) {
    return NextResponse.json(
      { ok: false, error: "Passwörter stimmen nicht überein" },
      { status: 400 }
    );
  }

  const hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hash, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true, redirectToLogin: true });
}
