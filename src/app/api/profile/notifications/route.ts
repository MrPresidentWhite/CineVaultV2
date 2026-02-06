/**
 * POST /api/profile/notifications
 * Speichert E-Mail-Benachrichtigungen: aktivieren/deaktivieren + Status-Vorgaben.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Status } from "@/generated/prisma/enums";

const VALID_STATUSES = new Set<string>(Object.values(Status));

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  let body: { notificationsEnabled?: boolean; statusPreferences?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Request-Body" },
      { status: 400 }
    );
  }

  const enabled = Boolean(body.notificationsEnabled);
  const rawPrefs = Array.isArray(body.statusPreferences) ? body.statusPreferences : [];
  const prefs: Array<{ userId: number; status: (typeof Status)[keyof typeof Status] }> = rawPrefs
    .filter((s): s is (typeof Status)[keyof typeof Status] => typeof s === "string" && VALID_STATUSES.has(s))
    .map((status) => ({ userId: auth.user!.id, status }));

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: auth.user!.id },
      data: { notificationsEnabled: enabled },
    });
    await tx.userStatusPreference.deleteMany({ where: { userId: auth.user!.id } });
    if (enabled && prefs.length > 0) {
      await tx.userStatusPreference.createMany({ data: prefs });
    }
  });

  return NextResponse.json({ ok: true });
}
