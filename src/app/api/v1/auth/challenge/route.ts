import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

const CHALLENGE_TTL_SEC = 5 * 60; // 5 Minuten
const NONCE_BYTES = 32;

/**
 * POST /api/v1/auth/challenge
 * Body: { fingerprint: string } – Fingerprint des aktiven API-Keys (SHA256, hex mit Doppelpunkten).
 * Liefert eine einmalige Challenge für Challenge-Response-Auth.
 * Kein Session-Cookie erforderlich (Proxy lässt /api/v1 durch).
 */
export async function POST(request: Request) {
  let body: { fingerprint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiges JSON" },
      { status: 400 }
    );
  }

  const fingerprint =
    typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
  if (!fingerprint) {
    return NextResponse.json(
      { error: "fingerprint fehlt" },
      { status: 400 }
    );
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      fingerprint,
      isActiveKey: true,
      verificationKeyEncrypted: { not: null },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: { id: true },
  });

  if (!apiKey) {
    return NextResponse.json(
      { error: "Key nicht gefunden oder nicht aktiv" },
      { status: 404 }
    );
  }

  const nonce = randomBytes(NONCE_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SEC * 1000);

  const challenge = await prisma.authChallenge.create({
    data: {
      nonce,
      apiKeyId: apiKey.id,
      expiresAt,
    },
  });

  return NextResponse.json({
    challengeId: challenge.id,
    nonce,
    expiresAt: expiresAt.toISOString(),
  });
}
