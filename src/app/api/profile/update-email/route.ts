import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiges JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Ungültige E-Mail-Adresse" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findFirst({
    where: { email, id: { not: auth.user.id } },
  });
  if (existing) {
    return NextResponse.json(
      { ok: false, error: "Diese E-Mail-Adresse wird bereits verwendet" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { email },
  });

  return NextResponse.json({ ok: true });
}
