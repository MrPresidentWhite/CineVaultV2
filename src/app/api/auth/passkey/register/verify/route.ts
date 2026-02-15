/**
 * POST /api/auth/passkey/register/verify
 * Verifies WebAuthn registration response and stores credential. Requires auth + CSRF.
 */

import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getSessionIdFromCookie } from "@/lib/session";
import { getCsrfTokenFromRequest, requireCsrf, generateCsrfToken } from "@/lib/csrf";
import { updateSession } from "@/lib/session";
import {
  getWebAuthnRpId,
  getWebAuthnOrigin,
  generatePasskeyDisplayName,
} from "@/lib/webauthn";
import { getRegistrationChallenge } from "@/lib/webauthn-challenge";

function uint8ArrayToBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString("base64");
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  let body: { response?: unknown; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Body" },
      { status: 400 }
    );
  }

  const csrfToken = getCsrfTokenFromRequest(request, body);
  const csrfError = requireCsrf(auth.session, csrfToken);
  if (csrfError) {
    return NextResponse.json({ ok: false, error: csrfError }, { status: 403 });
  }

  const sid = await getSessionIdFromCookie();
  if (!sid) {
    return NextResponse.json(
      { ok: false, error: "Keine Session" },
      { status: 401 }
    );
  }

  const response = body.response;
  if (!response || typeof response !== "object") {
    return NextResponse.json(
      { ok: false, error: "Keine Registrierungsantwort" },
      { status: 400 }
    );
  }

  const challengePayload = await getRegistrationChallenge(sid);
  if (!challengePayload) {
    return NextResponse.json(
      { ok: false, error: "Challenge abgelaufen. Bitte erneut versuchen." },
      { status: 400 }
    );
  }

  const { challenge: expectedChallenge, webauthnUserId } = challengePayload;
  const rpID = getWebAuthnRpId(request);
  const origin = getWebAuthnOrigin(request);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    console.error("[Passkey] verify error:", err);
    return NextResponse.json(
      { ok: false, error: "Verifizierung fehlgeschlagen." },
      { status: 400 }
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json(
      { ok: false, error: "Registrierung konnte nicht verifiziert werden." },
      { status: 400 }
    );
  }

  const { credential, credentialDeviceType, credentialBackedUp: _credentialBackedUp } =
    verification.registrationInfo;

  const transportsStr = credential.transports?.length
    ? credential.transports.join(",")
    : null;

  const customName =
    typeof body.name === "string" ? body.name.trim() || null : null;
  const displayName =
    customName ??
    generatePasskeyDisplayName(
      credentialDeviceType,
      credential.transports ?? null
    );

  await prisma.webAuthnCredential.create({
    data: {
      userId: auth.user.id,
      credentialId: credential.id,
      publicKey: uint8ArrayToBase64(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: transportsStr,
      deviceType: credentialDeviceType,
      name: displayName,
      webauthnUserId,
    },
  });

  const newCsrfToken = generateCsrfToken();
  await updateSession(sid, {
    ...auth.session,
    csrfToken: newCsrfToken,
  });

  return NextResponse.json({
    ok: true,
    csrfToken: newCsrfToken,
  });
}
