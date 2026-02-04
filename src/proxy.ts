/**
 * Next.js Proxy (ehem. Middleware): Geschützte Routen absichern.
 * Prüft nur das Vorhandensein des Session-Cookies (cv.sid).
 * Die eigentliche Session-Validierung erfolgt in getAuth() / getSession().
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session/config";

const LOGIN_PATH = "/login";

/** Pfade, die ohne Session erreichbar sind. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/api/auth",
] as const;

/** Präfixe, die immer erlaubt sind (_next, static). */
const ALLOWED_PREFIXES = ["/_next", "/favicon", "/assets"];

function isPublicPath(pathname: string): boolean {
  if (ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (PUBLIC_PATHS.some((p) => p === pathname || pathname.startsWith(p + "/")))
    return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sid = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sid) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Alle Pfade außer _next, static, favicon.
     * Siehe: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
