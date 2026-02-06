/**
 * Öffentliche URL/Origin hinter Reverse-Proxy (z. B. Nginx).
 * request.url ist hinter dem Proxy oft http://localhost:3000 – Redirects würden
 * sonst auf localhost zeigen. Hier: X-Forwarded-Proto/Host auswerten, Fallback APP_URL.
 */

import { APP_URL } from "@/lib/env";

/**
 * Ermittelt die vom User sichtbare Origin (für Redirects).
 * Nutzt X-Forwarded-Proto und Host, falls gesetzt, sonst request.url, sonst APP_URL.
 */
export function getPublicOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    ?? request.headers.get("host");
  if (host) {
    const proto = forwardedProto === "https" ? "https" : forwardedProto === "http" ? "http" : undefined;
    const fallbackProto = request.url.startsWith("https") ? "https" : "http";
    return `${proto ?? fallbackProto}://${host}`.replace(/\/+$/, "");
  }
  try {
    const urlOrigin = new URL(request.url).origin;
    if (urlOrigin && urlOrigin !== "http://localhost:3000" && urlOrigin !== "http://127.0.0.1:3000") {
      return urlOrigin.replace(/\/+$/, "");
    }
  } catch {
    /* ignore */
  }
  return APP_URL.replace(/\/+$/, "");
}

/**
 * Baut eine absolute URL für einen Pfad unter der öffentlichen Origin.
 */
export function getPublicUrl(request: Request, path: string): string {
  const origin = getPublicOrigin(request);
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${p}`;
}
