/**
 * API v1 Session-Konfiguration (Challenge-Response-Auth, kein Bearer).
 */

export const API_SESSION_COOKIE_NAME = "cv.api_sid";

/** TTL in Sekunden (1 Stunde). */
export const API_SESSION_TTL_SEC = 60 * 60;

export const API_SESSION_KEY_PREFIX = "api_session:";
