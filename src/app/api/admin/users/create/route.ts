import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  let body: { name?: string; email?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiges JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").toLowerCase().trim();
  const password = (body.password ?? "").trim();
  const role = body.role === "ADMIN" || body.role === "EDITOR" ? body.role : "VIEWER";

  if (!name || !email || !password) {
    return NextResponse.json(
      { ok: false, error: "Name, E-Mail und Passwort sind erforderlich." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Passwort mindestens 6 Zeichen." },
      { status: 400 }
    );
  }

  try {
    const hash = await hashPassword(password);
    await prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        role: role as "ADMIN" | "EDITOR" | "VIEWER",
        mustChangePassword: true,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "E-Mail bereits vergeben." },
        { status: 400 }
      );
    }
    console.error("admin users create:", e);
    return NextResponse.json(
      { ok: false, error: "Anlegen fehlgeschlagen." },
      { status: 500 }
    );
  }
}
