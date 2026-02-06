/**
 * Kurz-Blurb für Hover-Panels (aus altem EJS makeBlurb).
 */

function sanitize(txt: string): string {
  return String(txt)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateWords(s: string, maxWords: number): [string, boolean] {
  const parts = s.split(" ");
  if (parts.length <= maxWords) return [s, false];
  return [parts.slice(0, maxWords).join(" "), true];
}

function truncateChars(s: string, maxChars: number): [string, boolean] {
  if (s.length <= maxChars) return [s, false];
  const cut = s.slice(0, maxChars);
  const idx = cut.lastIndexOf(" ");
  return [idx > 0 ? cut.slice(0, idx) : cut, true];
}

export type BlurbOptions = {
  maxWords?: number;
  maxChars?: number;
};

export function makeBlurb(
  src: string | null | undefined,
  opts: BlurbOptions = {}
): string {
  const { maxWords = 16, maxChars = 120 } = opts;
  const base = sanitize(src ?? "");
  if (!base) return "";
  let s = base;
  let shortened = false;
  let did: boolean;
  [s, did] = truncateWords(s, maxWords);
  shortened = shortened || did;
  [s, did] = truncateChars(s, maxChars);
  shortened = shortened || did;
  return shortened ? s + "…" : s;
}
