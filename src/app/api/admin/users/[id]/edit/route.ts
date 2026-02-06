import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

async function guardMaster(targetUserId: number, actorUserId: number): Promise<boolean> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isMasterAdmin: true },
  });
  if (!target?.isMasterAdmin) return true;
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { isMasterAdmin: true },
  });
  return !!(actor?.isMasterAdmin && actorUserId === targetUserId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Ungültige ID" }, { status: 400 });
  }

  const allowed = await guardMaster(idNum, auth.user.id);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Master-Admin kann nur sich selbst bearbeiten." },
      { status: 403 }
    );
  }

  let body: { name?: string; email?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiges JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").toLowerCase().trim();
  const role = body.role === "ADMIN" || body.role === "EDITOR" ? body.role : "VIEWER";

  if (!name || !email) {
    return NextResponse.json(
      { ok: false, error: "Name und E-Mail erforderlich." },
      { status: 400 }
    );
  }

  try {
    await prisma.user.update({
      where: { id: idNum },
      data: { name, email, role: role as "ADMIN" | "EDITOR" | "VIEWER" },
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
    return NextResponse.json(
      { ok: false, error: "Aktualisierung fehlgeschlagen." },
      { status: 500 }
    );
  }
}
