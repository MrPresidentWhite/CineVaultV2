/**
 * POST /api/auth/passkey/register/options
 * Generates WebAuthn registration options. Requires auth + CSRF.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/server";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getSessionIdFromCookie } from "@/lib/session";
import { getCsrfTokenFromRequest, requireCsrf } from "@/lib/csrf";
import {
  getWebAuthnRpId,
  getWebAuthnOrigin,
  WEBAUTHN_RP_NAME,
} from "@/lib/webauthn";
import {
  setRegistrationChallenge,
} from "@/lib/webauthn-challenge";

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  const csrfToken = getCsrfTokenFromRequest(request);
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

  const rpID = getWebAuthnRpId(request);
  const origin = getWebAuthnOrigin(request);
  const user = auth.user;

  const existingCredentials = await prisma.webAuthnCredential.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  });

  const excludeCredentials = existingCredentials.map((c) => ({
    id: c.credentialId,
    transports: c.transports
      ? (c.transports.split(",") as Array<"internal" | "usb" | "ble" | "nfc" | "cable" | "hybrid" | "smart-card">)
      : undefined,
  }));

  const userID = randomBytes(32);
  const options: PublicKeyCredentialCreationOptionsJSON =
    await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID,
      userName: user.email,
      userID,
      userDisplayName: user.name ?? undefined,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

  const webauthnUserId = options.user.id;
  const stored = await setRegistrationChallenge(
    sid,
    options.challenge,
    webauthnUserId
  );
  if (!stored) {
    return NextResponse.json(
      { ok: false, error: "Challenge konnte nicht gespeichert werden. Redis prüfen." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    options,
  });
}
