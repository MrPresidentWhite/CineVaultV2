import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/password";
import { parseSshKey } from "@/lib/ssh-key";
import { encryptVerificationKey } from "@/lib/api-key-crypto";

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
 * GET /api/dashboard/api-key
 * Liefert alle API-Keys des aktuellen Users (ohne Schlüsselinhalt).
 * Erfordert EDITOR.
 */
export async function GET() {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: auth.user.id },
    select: {
      id: true,
      label: true,
      fingerprint: true,
      createdAt: true,
      expiresAt: true,
      isActiveKey: true,
      lastSuccessfulAuth: true,
      lastFailedAuth: true,
      failedAttempts: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ok: true, keys });
}

/**
 * POST /api/dashboard/api-key
 * Body: keyContent (SSH-Key-Text), expiresAt? (YYYY-MM-DD), passphrase? (nicht gespeichert)
 * Erfordert EDITOR. Speichert Key als Argon2-Hash, Fingerprint und Label aus Key-Comment.
 */
export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  let body: { keyContent?: string; expiresAt?: string; passphrase?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiges JSON" },
      { status: 400 }
    );
  }

  const keyContent = typeof body.keyContent === "string" ? body.keyContent.trim() : "";
  if (!keyContent) {
    return NextResponse.json(
      { ok: false, error: "Schlüsselinhalt fehlt" },
      { status: 400 }
    );
  }

  const passphrase =
    typeof body.passphrase === "string" ? body.passphrase.trim() : undefined;
  const parsed = parseSshKey(keyContent, { passphrase });
  if (typeof parsed === "string") {
    if (parsed === "INVALID_FORMAT") {
      return NextResponse.json(
        { ok: false, error: "Ungültiges Schlüsselformat" },
        { status: 400 }
      );
    }
    if (parsed === "UNSUPPORTED_TYPE") {
      return NextResponse.json(
        { ok: false, error: "Nur RSA- und ED25519-Keys werden unterstützt" },
        { status: 400 }
      );
    }
    if (parsed === "ENCRYPTED_KEY") {
      return NextResponse.json(
        { ok: false, error: "Verschlüsselter Schlüssel: Passphrase erforderlich" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Schlüssel konnte nicht gelesen werden" },
      { status: 400 }
    );
  }

  const expiresResult = parseExpiresAt(body.expiresAt);
  if (expiresResult.error) {
    return NextResponse.json(
      { ok: false, error: expiresResult.error },
      { status: 400 }
    );
  }

  const keyHash = await hashPassword(keyContent);
  const userId = auth.user.id;

  const existingCount = await prisma.apiKey.count({
    where: { userId },
  });
  const isActiveKey = existingCount === 0;

  await prisma.apiKey.create({
    data: {
      userId,
      keyContentHash: keyHash,
      verificationKeyEncrypted: encryptVerificationKey(parsed.publicKeySsh),
      label: parsed.label,
      fingerprint: parsed.fingerprint,
      expiresAt: expiresResult.date ?? undefined,
      isActiveKey,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Schlüssel erfolgreich hochgeladen",
    label: parsed.label,
    fingerprint: parsed.fingerprint,
  });
}
