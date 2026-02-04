/**
 * Session-API für Next.js (Cookie-basiert, Daten in Prisma).
 * Cookie-Name: cv.sid, Wert: Session-ID.
 */

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import {
  destroySessionInStore,
  getSessionFromStore,
  setSessionInStore,
  touchSessionInStore,
  type SessionData,
} from "./store";
import { SESSION_COOKIE_MAX_AGE_SEC, SESSION_COOKIE_NAME } from "./config";

export type { SessionData } from "./store";

export { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_SEC } from "./config";

function generateSid(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Liest die aktuelle Session-ID aus dem Cookie (Server-seitig).
 */
export async function getSessionIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Lädt die Session-Daten aus dem Store (falls gültige sid im Cookie).
 */
export async function getSession(meta?: {
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<SessionData | null> {
  const sid = await getSessionIdFromCookie();
  if (!sid) return null;
  const session = await getSessionFromStore(sid);
  if (!session) return null;
  if (meta) {
    await touchSessionInStore(sid, session);
  }
  return session;
}

/**
 * Erstellt eine neue Session und gibt die sid zurück.
 * Der Aufrufer muss das Cookie setzen (z. B. in Route Handler).
 */
export async function createSession(
  data: Omit<SessionData, "cookie"> & { cookie?: { maxAge?: number } },
  meta?: { ipAddress?: string | null; userAgent?: string | null }
): Promise<{ sid: string }> {
  const sid = generateSid();
  const session: SessionData = {
    ...data,
    cookie: { maxAge: data.cookie?.maxAge ?? SESSION_COOKIE_MAX_AGE_SEC * 1000 },
  };
  await setSessionInStore(sid, session, meta);
  return { sid };
}

/**
 * Aktualisiert die Session-Daten (z. B. viewAsRole).
 */
export async function updateSession(
  sid: string,
  data: Partial<SessionData>
): Promise<void> {
  const existing = await getSessionFromStore(sid);
  if (!existing) return;
  const merged: SessionData = { ...existing, ...data };
  await setSessionInStore(sid, merged);
}

/**
 * Löscht die Session im Store. Aufrufer sollte Cookie entfernen.
 */
export async function destroySession(sid: string): Promise<void> {
  await destroySessionInStore(sid);
}

/**
 * Cookie-Optionen für cv.sid (zum Setzen in Response).
 */
export function getSessionCookieOptions(expiresInSeconds?: number) {
  const maxAge = expiresInSeconds ?? SESSION_COOKIE_MAX_AGE_SEC;
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}
