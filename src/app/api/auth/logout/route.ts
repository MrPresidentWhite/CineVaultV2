import { NextResponse } from "next/server";
import { getSessionIdFromCookie, destroySession, SESSION_COOKIE_NAME } from "@/lib/session";
import { ROLE_COOKIE_NAME } from "@/lib/session/config";

/**
 * POST /api/auth/logout
 * Zerstört die Session im Store und löscht das Cookie, leitet zu / weiter.
 */
export async function POST(request: Request) {
  const sid = await getSessionIdFromCookie();
  if (sid) {
    await destroySession(sid);
  }

  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url.origin), {
    status: 302,
  });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.cookies.set(ROLE_COOKIE_NAME, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
