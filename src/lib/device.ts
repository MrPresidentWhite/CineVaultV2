/**
 * Leitet aus dem User-Agent einen Gerätetyp ab (Desktop, Mobile, Web-Fallback).
 * Für Anzeige in der Geräte-Übersicht (Icons).
 */
export type DeviceType = "desktop" | "mobile" | "web";

export function getDeviceTypeFromUserAgent(userAgent: string | null): DeviceType {
  if (!userAgent) return "web";

  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|ipad|webos|blackberry|iemobile|opera mini/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}
