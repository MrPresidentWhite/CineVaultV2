import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/password";
import crypto from "node:crypto";

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

function generateTempPassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$?";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export async function POST(
  _request: Request,
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

  const target = await prisma.user.findUnique({
    where: { id: idNum },
    select: { id: true, name: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ ok: false, error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const allowed = await guardMaster(idNum, auth.user.id);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Master-Admin kann nicht von anderen zurückgesetzt werden." },
      { status: 403 }
    );
  }

  const temp = generateTempPassword(14);
  const hash = await hashPassword(temp);
  await prisma.user.update({
    where: { id: idNum },
    data: { password: hash, mustChangePassword: true },
  });

  return NextResponse.json({
    ok: true,
    tempPassword: temp,
    user: { id: target.id, name: target.name, email: target.email },
  });
}
