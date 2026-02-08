import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getPublicOrigin, getSafeCallbackPath } from "@/lib/request-url";
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
  TRUST_COOKIE_NAME,
  PENDING_2FA_COOKIE_NAME,
  createPending2FaPayload,
  PENDING_2FA_MAX_AGE_SEC,
} from "@/lib/two-factor";

const RATE_LIMIT_MSG =
  "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.";
const LOCKED_UNTIL_MSG =
  "Konto vorübergehend gesperrt (zu viele Fehlversuche). Bitte später erneut.";

/**
 * POST /api/auth/login
 * FormData: email, password, remember (optional), callbackUrl (optional).
 * Prüft User, legt Session an, setzt Cookie, leitet zu callbackUrl weiter.
 * Rate-Limit pro IP und pro Account (15 Min Fenster).
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email")?.toString()?.trim();
  const password = formData.get("password")?.toString();
  const remember = formData.get("remember") === "1";
  const callbackUrl =
    formData.get("callbackUrl")?.toString()?.trim() || "/";

  const base = getPublicOrigin(request) + "/";
  const ip = getClientIp(request);

  if (!email) {
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent("E-Mail fehlt.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  if (!password) {
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent("Passwort fehlt.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  const rateLimit = await checkLoginRateLimit(ip, email);
  if (!rateLimit.allowed) {
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent(RATE_LIMIT_MSG)}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      password: true,
      role: true,
      locked: true,
      lockedUntil: true,
      totpEnabledAt: true,
      isMasterAdmin: true,
    },
  });

  if (!user) {
    await recordLoginFailure(ip, email, "LOGIN");
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent("E-Mail oder Passwort ungültig.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  if (user.locked) {
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent("Konto ist gesperrt.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }
  if (isUserLockedUntil(user)) {
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent(LOCKED_UNTIL_MSG)}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    const cookieStore = await cookies();
    const trustCookie = cookieStore.get(TRUST_COOKIE_NAME)?.value;
    const fromTrustedDevice = await isRequestFromTrustedDevice(user.id, trustCookie ?? null);
    if (!fromTrustedDevice) {
      await recordLoginFailure(ip, email, "LOGIN");
    }
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent("E-Mail oder Passwort ungültig.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  if (user.totpEnabledAt) {
    const cookieStore = await cookies();
    const trustCookie = cookieStore.get(TRUST_COOKIE_NAME)?.value;
    let trusted = false;
    if (trustCookie) {
      const tokenHash = createHash("sha256").update(trustCookie, "utf8").digest("hex");
      const device = await prisma.trustedDevice.findFirst({
        where: {
          userId: user.id,
          tokenHash,
          expiresAt: { gt: new Date() },
        },
      });
      trusted = !!device;
    }
    if (!trusted) {
      const payload = createPending2FaPayload(user.id);
      const res = NextResponse.redirect(
        new URL(
          `login/2fa?callbackUrl=${encodeURIComponent(callbackUrl)}`,
          base
        ),
        { status: 302 }
      );
      res.cookies.set(PENDING_2FA_COOKIE_NAME, payload, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: PENDING_2FA_MAX_AGE_SEC,
        path: "/",
      });
      return res;
    }
  }

  const effectiveRole =
    (user as { isMasterAdmin?: boolean }).isMasterAdmin === true
      ? "ADMIN"
      : user.role;

  const { sid } = await createSession(
    { userId: user.id, rememberMe: remember, effectiveRole },
    {
      ipAddress:
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        null,
      userAgent: request.headers.get("user-agent") ?? null,
    }
  );

  const opts = getSessionCookieOptions();
  const safePath = getSafeCallbackPath(callbackUrl, base);
  const response = NextResponse.redirect(new URL(safePath, base), {
    status: 302,
  });
  response.cookies.set(SESSION_COOKIE_NAME, sid, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: opts.maxAge,
    path: opts.path,
  });

  return response;
}
