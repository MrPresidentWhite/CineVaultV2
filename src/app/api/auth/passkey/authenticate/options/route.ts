/**
 * POST /api/auth/passkey/authenticate/options
 * Generates WebAuthn authentication options (usernameless).
 * User is not logged in - challenge stored in Redis, keyed by cookie.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getWebAuthnRpId } from "@/lib/webauthn";
import {
  setAuthenticationChallenge,
  generateChallengeSessionId,
  WEBAUTHN_CHALLENGE_COOKIE_NAME,
} from "@/lib/webauthn-challenge";

export async function POST(request: Request) {
  const rpID = getWebAuthnRpId(request);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [],
    userVerification: "preferred",
  });

  const challengeSessionId = generateChallengeSessionId();
  const stored = await setAuthenticationChallenge(
    challengeSessionId,
    options.challenge
  );
  if (!stored) {
    return NextResponse.json(
      { ok: false, error: "Challenge konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true, options });
  response.cookies.set(WEBAUTHN_CHALLENGE_COOKIE_NAME, challengeSessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  return response;
}
