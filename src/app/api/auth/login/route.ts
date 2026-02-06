import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getPublicOrigin } from "@/lib/request-url";
import {
  createSession,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import { ROLE_COOKIE_NAME } from "@/lib/session/config";

/**
 * POST /api/auth/login
 * FormData: email, password, remember (optional), callbackUrl (optional).
 * Prüft User, legt Session an, setzt Cookie, leitet zu callbackUrl weiter.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email")?.toString()?.trim();
  const password = formData.get("password")?.toString();
  const remember = formData.get("remember") === "1";
  const callbackUrl =
    formData.get("callbackUrl")?.toString()?.trim() || "/";

  const base = getPublicOrigin(request) + "/";
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

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
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

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent("E-Mail oder Passwort ungültig.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  const { sid } = await createSession(
    { userId: user.id, rememberMe: remember },
    {
      ipAddress:
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        null,
      userAgent: request.headers.get("user-agent") ?? null,
    }
  );

  const opts = getSessionCookieOptions();
  const response = NextResponse.redirect(new URL(callbackUrl, base), {
    status: 302,
  });
  response.cookies.set(SESSION_COOKIE_NAME, sid, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: opts.maxAge,
    path: opts.path,
  });
  const effectiveRole =
    (user as { isMasterAdmin?: boolean }).isMasterAdmin === true
      ? "ADMIN"
      : user.role;
  response.cookies.set(ROLE_COOKIE_NAME, effectiveRole, {
    httpOnly: false,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: opts.maxAge,
    path: opts.path,
  });

  return response;
}
