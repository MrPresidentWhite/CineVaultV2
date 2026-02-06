/**
 * Session-Konfiguration (Cookie-Name, MaxAge).
 */

export const SESSION_COOKIE_NAME = "cv.sid";

/** Rollen-Cookie für Proxy (Routen-Schutz); Wert: VIEWER | EDITOR | ADMIN. */
export const ROLE_COOKIE_NAME = "cv.role";

/** MaxAge in Sekunden (30 Tage). */
export const SESSION_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;
