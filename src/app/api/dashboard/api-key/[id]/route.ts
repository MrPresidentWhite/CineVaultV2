import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/** YYYY-MM-DD, gültiges Kalenderdatum. */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseExpiresAt(
  value: unknown
): { date: Date | null; error?: string } {
  if (value === undefined || value === null || value === "") {
    return { date: null };
  }
  if (typeof value !== "string") {
    return { date: null, error: "Ablaufdatum: ungültiger Typ" };
  }
  const trimmed = value.trim();
  if (trimmed === "") return { date: null };
  if (!ISO_DATE_REGEX.test(trimmed)) {
    return { date: null, error: "Ablaufdatum: Format YYYY-MM-DD erforderlich" };
  }
  const d = new Date(trimmed + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) {
    return { date: null, error: "Ablaufdatum: ungültiges Datum" };
  }
  return { date: d };
}

/**
 * PATCH /api/dashboard/api-key/[id]
 * Body: label? (Key-Name), expiresAt? (YYYY-MM-DD oder leer), isActiveKey? (boolean)
 * Erfordert EDITOR. Bei isActiveKey: true werden alle anderen Keys des Users auf false gesetzt.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID fehlt" },
      { status: 400 }
    );
  }

  const key = await prisma.apiKey.findFirst({
    where: { id, userId: auth.user.id },
  });
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Schlüssel nicht gefunden" },
      { status: 404 }
    );
  }

  let body: { label?: string; expiresAt?: string; isActiveKey?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiges JSON" },
      { status: 400 }
    );
  }

  const labelValue =
    typeof body.label !== "undefined"
      ? (typeof body.label === "string" ? body.label.trim() : "") || null
      : undefined;

  const expiresResult =
    typeof body.expiresAt !== "undefined"
      ? parseExpiresAt(body.expiresAt)
      : { date: undefined as Date | null | undefined, error: undefined };
  if (expiresResult.error) {
    return NextResponse.json(
      { ok: false, error: expiresResult.error },
      { status: 400 }
    );
  }

  const buildData = () => {
    const data: {
      label?: string | null;
      expiresAt?: Date | null;
      isActiveKey?: boolean;
    } = {};
    if (labelValue !== undefined) data.label = labelValue;
    if (typeof body.expiresAt !== "undefined")
      data.expiresAt = expiresResult.date ?? null;
    return data;
  };

  if (typeof body.isActiveKey === "boolean" && body.isActiveKey) {
    const data = buildData();
    await prisma.$transaction([
      prisma.apiKey.updateMany({
        where: { userId: auth.user.id },
        data: { isActiveKey: false },
      }),
      prisma.apiKey.update({
        where: { id },
        data: {
          isActiveKey: true,
          ...(data.label !== undefined && { label: data.label }),
          ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
        },
      }),
    ]);
  } else {
    const data = buildData();
    if (typeof body.isActiveKey === "boolean" && !body.isActiveKey) {
      data.isActiveKey = false;
    }
    if (Object.keys(data).length > 0) {
      await prisma.apiKey.update({ where: { id }, data });
    }
  }

  const updated = await prisma.apiKey.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      fingerprint: true,
      createdAt: true,
      expiresAt: true,
      isActiveKey: true,
    },
  });

  return NextResponse.json({ ok: true, key: updated });
}

/**
 * DELETE /api/dashboard/api-key/[id]
 * Erfordert EDITOR. Löscht den Key des aktuellen Users.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID fehlt" },
      { status: 400 }
    );
  }

  const key = await prisma.apiKey.findFirst({
    where: { id, userId: auth.user.id },
  });
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Schlüssel nicht gefunden" },
      { status: 404 }
    );
  }

  await prisma.apiKey.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
