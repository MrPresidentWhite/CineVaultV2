/**
 * CSRF: Token pro Session, Abgleich bei sensiblen POST-Requests.
 * Token aus Header X-CSRF-Token oder Body csrfToken.
 */

import { randomBytes } from "node:crypto";
import type { SessionData } from "@/lib/session/store";

const CSRF_TOKEN_BYTES = 32;

export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString("base64url");
}

/**
 * Liest CSRF-Token aus Request: zuerst Header X-CSRF-Token, sonst Body (bei JSON).
 * Body muss bereits geparst sein (z. B. request.json()).
 */
export function getCsrfTokenFromRequest(
  request: Request,
  parsedBody?: Record<string, unknown> | null
): string | null {
  const header = request.headers.get("x-csrf-token")?.trim();
  if (header) return header;
  const fromBody = parsedBody?.csrfToken;
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();
  return null;
}

/**
 * Prüft, ob der übergebene Token mit dem in der Session gespeicherten übereinstimmt.
 * Gibt bei Fehler eine Fehlermeldung zurück, sonst null.
 */
export function requireCsrf(
  session: SessionData,
  token: string | null
): string | null {
  const sessionToken =
    typeof session.csrfToken === "string" ? session.csrfToken : null;
  if (!token || !sessionToken) {
    return "CSRF-Token fehlt.";
  }
  if (token !== sessionToken) {
    return "CSRF-Token ungültig.";
  }
  return null;
}
