/**
 * Next.js Proxy (ehem. Middleware): Geschützte Routen absichern + Smart Back-Navigation.
 * - Prüft Session-Cookie (cv.sid); Validierung in getAuth() / getSession().
 * - Rollen-Cookie (cv.role): blockiert Routen, für die der User keine Berechtigung hat.
 * - Pflegt Nav-Stack und setzt backUrl-Cookie für „smart“ Zurück-Buttons.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/session/config";
import { getSessionFromStore } from "@/lib/session/store";
import {
  normalizeUrl,
  isIgnoredPath,
  parseNavStackCookie,
  updateStackAndGetBack,
} from "@/lib/backnav";
import { getRequiredRole, hasRoleAtLeast } from "@/lib/proxy-routes";

const LOGIN_PATH = "/login";
const NAV_STACK_COOKIE = "navStack";
const BACK_URL_COOKIE = "backUrl";

/** Wohin umleiten, wenn Rolle nicht ausreicht (Dashboard statt Login, da bereits eingeloggt). */
const FORBIDDEN_REDIRECT = "/dashboard";

/** Pfade, die ohne Session erreichbar sind. "/" ist bewusst nicht dabei – in Prod ohne Login → /login. */
const PUBLIC_PATHS = ["/login", "/api/auth"] as const;

/** Präfixe, die immer erlaubt sind (_next, static). */
const ALLOWED_PREFIXES = ["/_next", "/favicon", "/assets"];

function isPublicPath(pathname: string): boolean {
  if (ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (PUBLIC_PATHS.some((p) => p === pathname || pathname.startsWith(p + "/")))
    return true;
  return false;
}

/** Setzt Back-Nav-Cookies auf die Response (nur GET, document, nicht-ignorierte Pfade). */
function applyBackNav(request: NextRequest, response: NextResponse): void {
  const method = request.method;
  const dest = request.headers.get("sec-fetch-dest") ?? "";
  const accept = request.headers.get("accept") ?? "";
  if (method !== "GET") return;
  if (dest !== "document" && !accept.includes("text/html")) return;

  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const current = normalizeUrl(pathname + search);
  if (isIgnoredPath(pathname)) return;

  let refererNormalized: string | null = null;
  const refererRaw = request.headers.get("referer");
  if (refererRaw) {
    try {
      const refUrl = new URL(refererRaw);
      if (refUrl.origin === request.nextUrl.origin) {
        refererNormalized = normalizeUrl(refUrl.pathname + refUrl.search);
      }
    } catch {
      /* ungültiger Referer */
    }
  }

  const stack = parseNavStackCookie(request.cookies.get(NAV_STACK_COOKIE)?.value);
  const backUrl = updateStackAndGetBack(stack, current, refererNormalized);

  response.cookies.set(NAV_STACK_COOKIE, JSON.stringify(stack), {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(BACK_URL_COOKIE, backUrl, {
    path: "/",
    maxAge: 60 * 60,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sid = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isDev =
    ["dev", "development", "developement"].includes(
      (process.env.ENVIRONMENT ?? "prod").toLowerCase()
    );

  /** Kein Cookie oder Session in DB ungültig/abgelaufen → wie nicht angemeldet behandeln. */
  let sessionValid = false;
  if (sid) {
    try {
      const session = await getSessionFromStore(sid);
      sessionValid = session != null && session.userId != null;
    } catch {
      sessionValid = false;
    }
  }

  if (!sessionValid) {
    const shouldAutoLogin = isDev && pathname === "/";
    if (isPublicPath(pathname) && !shouldAutoLogin) {
      const res = NextResponse.next();
      applyBackNav(request, res);
      return res;
    }
    const target = isDev
      ? new URL("/api/auth/dev-login", request.url)
      : new URL(LOGIN_PATH, request.url);
    target.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(target);
  }

  const requiredRole = getRequiredRole(pathname);
  if (requiredRole) {
    const userRole = request.cookies.get(ROLE_COOKIE_NAME)?.value?.trim();
    if (userRole && !hasRoleAtLeast(userRole, requiredRole)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden", message: "Keine Berechtigung für diese Route." },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL(FORBIDDEN_REDIRECT, request.url), {
        status: 302,
      });
    }
  }

  const res = NextResponse.next();
  applyBackNav(request, res);
  return res;
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
