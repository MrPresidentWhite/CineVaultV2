import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { decryptVerificationKey } from "@/lib/api-key-crypto";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/dashboard/api-key/[id]/public-key
 * Liefert den öffentlichen SSH-Key als .pub-Datei zum Download.
 * Nur für Keys des aktuellen Users. Erfordert EDITOR.
 */
export async function GET(_request: Request, context: RouteContext) {
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
    select: {
      id: true,
      label: true,
      fingerprint: true,
      verificationKeyEncrypted: true,
    },
  });

  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Schlüssel nicht gefunden" },
      { status: 404 }
    );
  }

  if (!key.verificationKeyEncrypted?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Kein öffentlicher Schlüssel für diesen Key gespeichert" },
      { status: 404 }
    );
  }

  const publicKey = decryptVerificationKey(key.verificationKeyEncrypted);
  if (!publicKey.trim()) {
    return NextResponse.json(
      { ok: false, error: "Öffentlicher Schlüssel konnte nicht gelesen werden" },
      { status: 500 }
    );
  }

  const safeName = (key.label || key.fingerprint || key.id)
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 80) || "key";
  const filename = `cinevault-${safeName}.pub`;

  return new Response(publicKey.trimEnd() + "\n", {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
