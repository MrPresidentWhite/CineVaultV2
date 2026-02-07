import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { verifyChallengeSignature } from "@/lib/api-v1-auth";
import { decryptVerificationKey } from "@/lib/api-key-crypto";
import {
  setApiSession,
  API_SESSION_COOKIE_NAME,
  API_SESSION_TTL_SEC,
} from "@/lib/api-session";

/**
 * POST /api/v1/auth/verify
 * Body: { challengeId: string, signature: string } – Signatur (Base64, SSH-Format) über den Nonce.
 * Bei Erfolg: API-Session in Redis, Set-Cookie (cv.api_sid). Kein Bearer, kein Passwort.
 */
export async function POST(request: Request) {
  let body: { challengeId?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiges JSON" },
      { status: 400 }
    );
  }

  const challengeId =
    typeof body.challengeId === "string" ? body.challengeId.trim() : "";
  const signature =
    typeof body.signature === "string" ? body.signature.trim() : "";

  if (!challengeId || !signature) {
    return NextResponse.json(
      { error: "challengeId und signature erforderlich" },
      { status: 400 }
    );
  }

  const challenge = await prisma.authChallenge.findUnique({
    where: { id: challengeId },
    include: {
      apiKey: {
        select: {
          id: true,
          userId: true,
          verificationKeyEncrypted: true,
          failedAttempts: true,
          expiresAt: true,
        },
      },
    },
  });

  if (
    !challenge ||
    challenge.usedAt != null ||
    new Date(challenge.expiresAt) < new Date()
  ) {
    return NextResponse.json(
      { error: "Challenge ungültig oder abgelaufen" },
      { status: 400 }
    );
  }

  if (
    !challenge.apiKey.verificationKeyEncrypted ||
    (challenge.apiKey.expiresAt && new Date(challenge.apiKey.expiresAt) < new Date())
  ) {
    return NextResponse.json(
      { error: "Key nicht verifizierbar oder abgelaufen" },
      { status: 400 }
    );
  }

  const publicKeyPlain = decryptVerificationKey(challenge.apiKey.verificationKeyEncrypted);
  if (!publicKeyPlain) {
    return NextResponse.json(
      { error: "Key nicht verifizierbar" },
      { status: 400 }
    );
  }

  const valid = verifyChallengeSignature(
    publicKeyPlain,
    challenge.nonce,
    signature
  );

  if (!valid) {
    await prisma.apiKey.update({
      where: { id: challenge.apiKeyId },
      data: { failedAttempts: { increment: 1 } },
    });
    return NextResponse.json(
      { error: "Signatur ungültig" },
      { status: 401 }
    );
  }

  await prisma.$transaction([
    prisma.authChallenge.update({
      where: { id: challengeId },
      data: { usedAt: new Date() },
    }),
    prisma.apiKey.update({
      where: { id: challenge.apiKeyId },
      data: {
        lastUsed: new Date(),
        lastSuccessfulAuth: new Date(),
        failedAttempts: 0,
      },
    }),
  ]);

  const sid = randomBytes(24).toString("base64url");
  await setApiSession(sid, {
    userId: challenge.apiKey.userId,
    apiKeyId: challenge.apiKey.id,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(API_SESSION_COOKIE_NAME, sid, {
    path: "/api/v1",
    maxAge: API_SESSION_TTL_SEC,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return res;
}
