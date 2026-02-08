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

/** Letztes Wort-/Satzzeichen vor maxChars finden, damit nie mitten im Wort abgeschnitten wird. */
function lastBoundaryBefore(cut: string): number {
  let idx = -1;
  for (const c of [" ", ",", ".", "!", "?", ";", ":", "–", "—"]) {
    const i = cut.lastIndexOf(c);
    if (i > idx) idx = i;
  }
  return idx;
}

function truncateChars(s: string, maxChars: number): [string, boolean] {
  if (s.length <= maxChars) return [s, false];
  const cut = s.slice(0, maxChars);
  const idx = lastBoundaryBefore(cut);
  const out = idx > 0 ? cut.slice(0, idx) : cut;
  return [out.trimEnd(), true];
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
  return shortened ? s.trimEnd() + " [...]" : s;
}
