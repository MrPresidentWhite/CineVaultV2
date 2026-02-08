/**
 * Client-seitig: CSRF-Token von /api/csrf holen und für fetch-Requests verwenden.
 * Token wird pro Seite gecacht. Nach sensiblen Aktionen liefert die API einen neuen Token (Rotation).
 */

let cachedToken: string | null = null;

/**
 * Holt den CSRF-Token (einmal pro Session/Seite gecacht).
 * Für sensible POST-Requests als Header verwenden: X-CSRF-Token.
 */
export async function getCsrfToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const res = await fetch("/api/csrf", { credentials: "include" });
    const data = await res.json();
    if (data.ok && typeof data.csrfToken === "string") {
      cachedToken = data.csrfToken;
      return cachedToken;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Aktualisiert den gecachten Token (z. B. nach Response mit csrfToken bei Rotation).
 * Wird von Formularen aufgerufen, wenn die API einen neuen Token zurückgibt.
 */
export function setCsrfToken(token: string | null): void {
  cachedToken = token;
}

/**
 * Liefert Headers-Objekt mit X-CSRF-Token für fetch (nach getCsrfToken()).
 */
export function csrfHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { "X-CSRF-Token": token };
}
