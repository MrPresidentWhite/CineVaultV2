import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  createSession,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import {
  checkLoginRateLimit,
  getClientIp,
  recordLoginFailure,
  isUserLockedUntil,
  isRequestFromTrustedDevice,
} from "@/lib/login-rate-limit";
import {
  PENDING_2FA_COOKIE_NAME,
  TRUST_COOKIE_NAME,
  parsePending2FaPayload,
  decryptTotpSecret,
  verifyTotpToken,
  hashBackupCode,
} from "@/lib/two-factor";
import { getPublicOrigin, getSafeCallbackPath } from "@/lib/request-url";

const TRUST_DAYS = 30;
const RATE_LIMIT_MSG =
  "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.";
const LOCKED_UNTIL_MSG =
  "Konto vorübergehend gesperrt (zu viele Fehlversuche). Bitte später erneut.";
const TRUST_MAX_AGE_SEC = TRUST_DAYS * 24 * 60 * 60;

function hashTrustToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * POST /api/auth/login/2fa
 * Body: { code: string, trustDevice?: boolean, callbackUrl?: string }.
 * Verifiziert 2FA-Code (TOTP oder Backup), legt Session an, optional Trust-Cookie.
 */
export async function POST(request: Request) {
  const base = getPublicOrigin(request) + "/";
  const cookieStore = await cookies();
  const pendingEncrypted = cookieStore.get(PENDING_2FA_COOKIE_NAME)?.value;
  const payload = pendingEncrypted ? parsePending2FaPayload(pendingEncrypted) : null;
  if (!payload) {
    return NextResponse.redirect(
      new URL(
        "login?error=" + encodeURIComponent("2FA-Schritt abgelaufen. Bitte erneut anmelden."),
        base
      ),
      { status: 302 }
    );
  }

  let code = "";
  let callbackUrl = "/";
  let trustDevice = false;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: { code?: string; trustDevice?: boolean; callbackUrl?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.redirect(
        new URL("login?error=" + encodeURIComponent("Ungültige Anfrage."), base),
        { status: 302 }
      );
    }
    code = typeof body.code === "string" ? body.code.trim().replace(/\s/g, "") : "";
    callbackUrl = typeof body.callbackUrl === "string" && body.callbackUrl.trim()
      ? body.callbackUrl.trim()
      : "/";
    trustDevice = body.trustDevice === true;
  } else {
    const formData = await request.formData();
    code = formData.get("code")?.toString()?.trim()?.replace(/\s/g, "") ?? "";
    callbackUrl = formData.get("callbackUrl")?.toString()?.trim() || "/";
    trustDevice = formData.get("trustDevice") === "1";
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `login/2fa?error=${encodeURIComponent("Code fehlt.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  const ip = getClientIp(request);
  const identifier = `user:${payload.userId}`;
  const rateLimit = await checkLoginRateLimit(ip, identifier);
  if (!rateLimit.allowed) {
    return NextResponse.redirect(
      new URL(
        `login/2fa?error=${encodeURIComponent(RATE_LIMIT_MSG)}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      role: true,
      locked: true,
      lockedUntil: true,
      totpSecretEncrypted: true,
      totpEnabledAt: true,
      isMasterAdmin: true,
    },
  });

  if (!user?.totpEnabledAt) {
    const res = NextResponse.redirect(new URL("login?error=" + encodeURIComponent("2FA nicht aktiv."), base), {
      status: 302,
    });
    res.cookies.delete(PENDING_2FA_COOKIE_NAME);
    return res;
  }

  if (user.locked) {
    const res = NextResponse.redirect(
      new URL(
        `login/2fa?error=${encodeURIComponent("Konto ist gesperrt.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
    res.cookies.delete(PENDING_2FA_COOKIE_NAME);
    return res;
  }
  if (isUserLockedUntil(user)) {
    const res = NextResponse.redirect(
      new URL(
        `login/2fa?error=${encodeURIComponent(LOCKED_UNTIL_MSG)}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
    res.cookies.delete(PENDING_2FA_COOKIE_NAME);
    return res;
  }

  let codeValid = false;
  if (/^\d{6}$/.test(code)) {
    const secret = decryptTotpSecret(user.totpSecretEncrypted ?? "");
    codeValid = secret ? await verifyTotpToken(code, secret) : false;
  } else {
    const hash = hashBackupCode(code);
    const backup = await prisma.userBackupCode.findFirst({
      where: { userId: user.id, codeHash: hash, usedAt: null },
    });
    if (backup) {
      codeValid = true;
      await prisma.userBackupCode.update({
        where: { id: backup.id },
        data: { usedAt: new Date() },
      });
    }
  }

  if (!codeValid) {
    const trustCookie = cookieStore.get(TRUST_COOKIE_NAME)?.value;
    const fromTrustedDevice = await isRequestFromTrustedDevice(user.id, trustCookie ?? null);
    if (!fromTrustedDevice) {
      await recordLoginFailure(ip, identifier, "TWO_FA");
    }
    return NextResponse.redirect(
      new URL(
        `login/2fa?error=${encodeURIComponent("Code ungültig oder bereits verwendet.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  const effectiveRole = (user as { isMasterAdmin?: boolean }).isMasterAdmin === true ? "ADMIN" : user.role;

  const { sid } = await createSession(
    { userId: user.id, rememberMe: true, effectiveRole },
    {
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
      userAgent: request.headers.get("user-agent") ?? null,
    }
  );

  const opts = getSessionCookieOptions();
  const safePath = getSafeCallbackPath(callbackUrl, base);
  const response = NextResponse.redirect(new URL(safePath, base), { status: 302 });

  response.cookies.set(SESSION_COOKIE_NAME, sid, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: opts.maxAge,
    path: opts.path,
  });

  response.cookies.delete(PENDING_2FA_COOKIE_NAME);

  if (trustDevice) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashTrustToken(token);
    const expiresAt = new Date(Date.now() + TRUST_MAX_AGE_SEC * 1000);
    await prisma.trustedDevice.create({
      data: {
        userId: user.id,
        tokenHash,
        name: request.headers.get("user-agent")?.slice(0, 191) ?? null,
        expiresAt,
      },
    });
    response.cookies.set(TRUST_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TRUST_MAX_AGE_SEC,
      path: "/",
    });
  }

  return response;
}
