import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getSessionIdFromCookie, updateSession } from "@/lib/session";
import { TRUST_COOKIE_NAME } from "@/lib/two-factor";
import { getCsrfTokenFromRequest, requireCsrf, generateCsrfToken } from "@/lib/csrf";

const TRUST_DAYS = 30;
const TRUST_MAX_AGE_SEC = TRUST_DAYS * 24 * 60 * 60;

function hashTrustToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * POST /api/dashboard/security/2fa/trust-device
 * Markiert dieses Gerät als vertrauenswürdig (Cookie + DB). 2FA wird für TRUST_DAYS übersprungen.
 * Erfordert eingeloggt + EDITOR. 2FA muss aktiv sein.
 */
export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const csrfToken = getCsrfTokenFromRequest(request);
  const csrfError = requireCsrf(auth.session, csrfToken);
  if (csrfError) {
    return NextResponse.json({ ok: false, error: csrfError }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { totpEnabledAt: true },
  });

  if (!user?.totpEnabledAt) {
    return NextResponse.json(
      { ok: false, error: "2FA ist nicht aktiviert." },
      { status: 400 }
    );
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashTrustToken(token);
  const expiresAt = new Date(Date.now() + TRUST_MAX_AGE_SEC * 1000);

  await prisma.trustedDevice.create({
    data: {
      userId: auth.user.id,
      tokenHash,
      name: request.headers.get("user-agent")?.slice(0, 191) ?? null,
      expiresAt,
    },
  });

  const sid = await getSessionIdFromCookie();
  let csrfToken: string | undefined;
  if (sid) {
    csrfToken = generateCsrfToken();
    await updateSession(sid, { ...auth.session, csrfToken });
  }

  const response = NextResponse.json({
    ok: true,
    ...(csrfToken && { csrfToken }),
  });
  response.cookies.set(TRUST_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TRUST_MAX_AGE_SEC,
    path: "/",
  });

  return response;
}
