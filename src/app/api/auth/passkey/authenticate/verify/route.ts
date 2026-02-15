/**
 * POST /api/auth/passkey/authenticate/verify
 * Verifies WebAuthn auth response, creates session, redirects.
 * Body: { response, callbackUrl? }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/session";
import { getSafeCallbackPath, getPublicOrigin } from "@/lib/request-url";
import { getWebAuthnRpId, getWebAuthnOrigin } from "@/lib/webauthn";
import {
  getAuthenticationChallenge,
  WEBAUTHN_CHALLENGE_COOKIE_NAME,
} from "@/lib/webauthn-challenge";

function base64ToUint8Array(str: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(str, "base64");
  return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const challengeSessionId =
    cookieStore.get(WEBAUTHN_CHALLENGE_COOKIE_NAME)?.value;

  if (!challengeSessionId) {
    return NextResponse.json(
      { ok: false, error: "Challenge-Session fehlt. Seite neu laden." },
      { status: 400 }
    );
  }

  const expectedChallenge = await getAuthenticationChallenge(challengeSessionId);
  if (!expectedChallenge) {
    return NextResponse.json(
      { ok: false, error: "Challenge abgelaufen. Bitte erneut versuchen." },
      { status: 400 }
    );
  }

  let body: { response?: unknown; callbackUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Body" },
      { status: 400 }
    );
  }

  const response = body.response;
  if (!response || typeof response !== "object") {
    return NextResponse.json(
      { ok: false, error: "Keine Authentifizierungsantwort" },
      { status: 400 }
    );
  }

  const credentialId = (response as { id?: string }).id;
  if (!credentialId || typeof credentialId !== "string") {
    return NextResponse.json(
      { ok: false, error: "Credential-ID fehlt" },
      { status: 400 }
    );
  }

  const credential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId },
    include: { user: true },
  });

  if (!credential) {
    return NextResponse.json(
      { ok: false, error: "Passkey nicht gefunden." },
      { status: 404 }
    );
  }

  const user = credential.user;
  if (user.locked) {
    return NextResponse.json(
      { ok: false, error: "Konto ist gesperrt." },
      { status: 403 }
    );
  }

  const rpID = getWebAuthnRpId(request);
  const origin = getWebAuthnOrigin(request);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: response as Parameters<
        typeof verifyAuthenticationResponse
      >[0]["response"],
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: base64ToUint8Array(credential.publicKey),
        counter: Number(credential.counter),
        transports: credential.transports
          ? (credential.transports.split(",") as Array<
              "internal" | "usb" | "ble" | "nfc" | "cable" | "hybrid" | "smart-card"
            >)
          : undefined,
      },
    });
  } catch (err) {
    console.error("[Passkey] verify error:", err);
    return NextResponse.json(
      { ok: false, error: "Verifizierung fehlgeschlagen." },
      { status: 400 }
    );
  }

  if (!verification.verified) {
    return NextResponse.json(
      { ok: false, error: "Authentifizierung fehlgeschlagen." },
      { status: 400 }
    );
  }

  await prisma.webAuthnCredential.update({
    where: { id: credential.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  });

  const effectiveRole =
    (user as { isMasterAdmin?: boolean }).isMasterAdmin === true
      ? "ADMIN"
      : user.role;

  const { sid } = await createSession(
    {
      userId: user.id,
      rememberMe: true,
      effectiveRole,
    },
    {
      ipAddress:
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        null,
      userAgent: request.headers.get("user-agent") ?? null,
    }
  );

  const base = getPublicOrigin(request) + "/";
  const callbackUrl =
    typeof body.callbackUrl === "string" ? body.callbackUrl : "/";
  const safePath = getSafeCallbackPath(callbackUrl, base);

  const opts = getSessionCookieOptions();
  const res = NextResponse.json({
    ok: true,
    redirect: new URL(safePath, base).toString(),
  });

  res.cookies.set(SESSION_COOKIE_NAME, sid, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: opts.maxAge,
    path: opts.path,
  });

  res.cookies.set(WEBAUTHN_CHALLENGE_COOKIE_NAME, "", {
    maxAge: 0,
    path: "/",
  });

  return res;
}
