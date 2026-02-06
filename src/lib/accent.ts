/**
 * Accent-Farbe aus Bild-URL (z. B. für Banner, Poster-Fallback).
 * Nutzt ColorThief für dominante Farbe; Helligkeit wird ggf. angehoben.
 * Aus dem alten CineVault-Projekt (utils/accentColor.ts) übernommen.
 * Node-Version von ColorThief wird per createRequire erzwungen (Buffer-Support).
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Wird durch serverExternalPackages nicht gebündelt → Node lädt zur Laufzeit "main" (dist/color-thief.js) mit Buffer-Support.
const { getColor: getColorNode } = require("colorthief") as {
  getColor: (img: Buffer, quality?: number) => Promise<number[]>;
};

const FALLBACK = "#FFD700";

/** Bild von URL laden und als Buffer zurückgeben. */
export async function fetchImageBuffer(
  url?: string | null
): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

/** Helligkeit prüfen (HSL Lightness) und ggf. anheben, damit Farbe lesbar bleibt. */
function ensureReadable(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return FALLBACK;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const L = (max + min) / 510;
  if (L < 0.22) {
    const lift = 0.22 / Math.max(L, 0.001);
    const nr = Math.min(255, Math.round(r * lift));
    const ng = Math.min(255, Math.round(g * lift));
    const nb = Math.min(255, Math.round(b * lift));
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`.toUpperCase();
  }
  return hex.toUpperCase();
}

/** ColorThief (Node-Version): Buffer → dominante Farbe (hex). */
export async function colorThiefHexFromBuffer(buf: Buffer): Promise<string | null> {
  try {
    const rgb = await getColorNode(buf);
    if (!rgb || rgb.length < 3) return null;
    const hex =
      "#" +
      [0, 1, 2]
        .map((i) =>
          Math.max(0, Math.min(255, rgb[i] ?? 0))
            .toString(16)
            .padStart(2, "0")
        )
        .join("");
    return ensureReadable(hex);
  } catch {
    return null;
  }
}

/** Dominante Akzentfarbe aus Bild-URL (z. B. Banner). */
export async function getAccentFromImage(url?: string | null): Promise<string> {
  const buf = await fetchImageBuffer(url);
  if (!buf) return FALLBACK;
  const hex = await colorThiefHexFromBuffer(buf);
  return hex ?? FALLBACK;
}

/** Erst Poster-URL versuchen, sonst Backdrop (z. B. für Film-Karten). */
export async function getAccentFromUrls(
  poster?: string | null,
  backdrop?: string | null
): Promise<string> {
  const first = await getAccentFromImage(poster);
  if (first !== FALLBACK) return first;
  return getAccentFromImage(backdrop);
}

/** Dominante Akzentfarbe aus Bild-Buffer (z. B. aus R2 getObject). Kein Fetch nötig. */
export async function getAccentFromBuffer(buf: Buffer | null): Promise<string> {
  if (!buf || buf.length === 0) return FALLBACK;
  const hex = await colorThiefHexFromBuffer(buf);
  return hex ?? FALLBACK;
}
