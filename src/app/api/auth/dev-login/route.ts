import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicOrigin } from "@/lib/request-url";
import {
  createSession,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import { ROLE_COOKIE_NAME } from "@/lib/session/config";
import { isDev } from "@/lib/env";

/**
 * GET /api/auth/dev-login?callbackUrl=...
 * Nur wenn ENVIRONMENT=dev/development: loggt den Master-Admin automatisch ein,
 * setzt Session-Cookie und leitet zu callbackUrl (oder /) weiter.
 */
export async function GET(request: Request) {
  if (!isDev) {
    return NextResponse.json(
      { error: "Dev-Login nur wenn ENVIRONMENT=dev" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl")?.trim() || "/";
  const base = getPublicOrigin(request) + "/";

  const masterAdmin = await prisma.user.findFirst({
    where: { isMasterAdmin: true },
  });

  if (!masterAdmin) {
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent("Kein Master-Admin in der Datenbank gefunden.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  if (masterAdmin.locked) {
    return NextResponse.redirect(
      new URL(
        `login?error=${encodeURIComponent("Master-Admin-Konto ist gesperrt.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        base
      ),
      { status: 302 }
    );
  }

  const { sid } = await createSession(
    { userId: masterAdmin.id, rememberMe: true },
    {
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
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
  response.cookies.set(ROLE_COOKIE_NAME, "ADMIN", {
    httpOnly: false,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: opts.maxAge,
    path: opts.path,
  });

  return response;
}
