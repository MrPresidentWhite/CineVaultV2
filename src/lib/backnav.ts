/**
 * Smart Back-Navigation: History-Stack und bevorzugte Zurück-Ziele.
 * Wird von der Middleware genutzt (Cookie-basierter Stack) und von
 * Detailseiten zum Lesen der Back-URL.
 */

/** Pfade, die nicht in die History aufgenommen werden (APIs, Auth, Assets, Dashboard). */
export const IGNORE_PATHS = [
  "/api",
  "/_next",
  "/login",
  "/logout",
  "/favicon",
  "/robots",
  "/dashboard",
  "/dev",
  "/assets",
];

/** Query-Parameter, die für den History-Key ignoriert werden. */
export const IGNORE_QUERY_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "refresh",
  "nocache",
  "modal",
];

/** Ziele, die nie Back-Ziel sein sollen (Loops vermeiden). */
export const BACK_SKIP_PREFIXES = ["/dashboard/import", "/login"];

const MAX_STACK_LEN = 30;

export type RouteKind =
  | { type: "movie"; id: number }
  | { type: "collection"; id: number }
  | { type: "series"; id: number }
  | { type: "home" }
  | { type: "list_movies" }
  | { type: "list_collections" }
  | { type: "list_series" }
  | { type: "other" };

/**
 * Klassifiziert den Pfad (aktuelles App-Routing: /movies, /collections, /series + [id]).
 */
export function classifyPath(pathname: string): RouteKind {
  if (pathname === "/") return { type: "home" };
  if (pathname === "/movies" || pathname.startsWith("/movies?")) return { type: "list_movies" };
  if (pathname === "/collections" || pathname.startsWith("/collections?")) return { type: "list_collections" };
  if (pathname === "/series" || pathname.startsWith("/series?")) return { type: "list_series" };

  const movieMatch = pathname.match(/^\/movies\/(\d+)(?:\/|$)/);
  if (movieMatch) return { type: "movie", id: Number(movieMatch[1]) };

  const collectionMatch = pathname.match(/^\/collections\/(\d+)(?:\/|$)/);
  if (collectionMatch) return { type: "collection", id: Number(collectionMatch[1]) };

  const seriesMatch = pathname.match(/^\/series\/(\d+)(?:\/|$)/);
  if (seriesMatch) return { type: "series", id: Number(seriesMatch[1]) };

  return { type: "other" };
}

/**
 * Normalisiert URL zu pathname + sortierte Query (ohne Ignore-Params).
 * Erwartet pathname + search (kein Origin).
 */
export function normalizeUrl(pathnameAndSearch: string): string {
  try {
    const pathname = pathnameAndSearch.startsWith("/") ? pathnameAndSearch : `/${pathnameAndSearch}`;
    const qIndex = pathname.indexOf("?");
    const path = qIndex === -1 ? pathname : pathname.slice(0, qIndex);
    const search = qIndex === -1 ? "" : pathname.slice(qIndex + 1);
    const params = new URLSearchParams(search);
    IGNORE_QUERY_PARAMS.forEach((p) => params.delete(p));
    const sorted = new URLSearchParams([...params.entries()].sort((a, b) => a[0].localeCompare(b[0])));
    const qs = sorted.toString();
    return path + (qs ? `?${qs}` : "");
  } catch {
    return pathnameAndSearch.startsWith("/") ? pathnameAndSearch : "/";
  }
}

export function isIgnoredPath(pathname: string): boolean {
  return IGNORE_PATHS.some((p) => pathname.startsWith(p));
}

export function isBackSkipPath(pathname: string): boolean {
  return BACK_SKIP_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Echte Browser-Back-Erkennung: aktueller Pfad ist der vorherige im Stack,
 * Referer ist der letzte (wir sind „zurück“ gegangen).
 */
export function isTrueBackNav(
  current: string,
  refererNormalized: string | null,
  stack: string[]
): boolean {
  if (stack.length < 2 || !refererNormalized) return false;
  const top = stack[stack.length - 1];
  const second = stack[stack.length - 2];
  return refererNormalized === top && current === second;
}

/**
 * Bevorzugte Back-Ziele je nach aktuellem Kontext (Reihenfolge = Priorität).
 * Collection-Detail: zuerst Collection-Übersicht (mit Filtern), sonst Home.
 */
function preferredBackTargetsFor(kind: RouteKind): RouteKind["type"][] {
  switch (kind.type) {
    case "movie":
      return ["collection", "list_movies", "home"];
    case "collection":
      return ["list_collections", "home"];
    case "series":
      return ["list_series", "home"];
    default:
      return ["home"];
  }
}

/**
 * Sucht im Stack rückwärts den ersten Eintrag, der als Back-Ziel erlaubt ist.
 */
export function computeBackFromStack(stack: string[], currentNormalized: string): string {
  const kind = classifyPath(currentNormalized.split("?")[0]);
  const prefs = new Set(preferredBackTargetsFor(kind));

  for (let i = stack.length - 1; i >= 0; i--) {
    const candidate = stack[i];
    if (!candidate || candidate === currentNormalized) continue;
    if (isBackSkipPath(candidate)) continue;
    const candidateKind = classifyPath(candidate.split("?")[0]);
    if (!prefs.has(candidateKind.type)) continue;
    return candidate;
  }

  switch (kind.type) {
    case "movie":
    case "list_movies":
      return "/movies";
    case "collection":
      return "/collections";
    case "list_collections":
      return "/collections";
    case "series":
    case "list_series":
      return "/series";
    default:
      return "/";
  }
}

/**
 * Aktualisiert den Stack (mutiert das Array) und gibt die neue Back-URL zurück.
 * - Bei echtem Back: Stack pop, Back = neuer Top.
 * - Bei Reload (current === last): keine Änderung, Back aus Stack.
 * - Bei vorhanden im Stack: trimmen, Back aus Stack.
 * - Sonst: push, Back aus Stack (vor dem Push berechnet).
 */
export function updateStackAndGetBack(
  stack: string[],
  current: string,
  refererNormalized: string | null
): string {
  const last = stack[stack.length - 1];

  if (isTrueBackNav(current, refererNormalized, stack)) {
    stack.pop();
    return computeBackFromStack(stack, current);
  }

  if (last === current) {
    return computeBackFromStack(stack, current);
  }

  const existingIdx = stack.indexOf(current);
  if (existingIdx >= 0) {
    stack.length = existingIdx + 1;
    return computeBackFromStack(stack, current);
  }

  const backUrl = computeBackFromStack(stack, current);
  stack.push(current);
  if (stack.length > MAX_STACK_LEN) stack.shift();
  return backUrl;
}

/**
 * Parst den Nav-Stack aus dem Cookie (JSON-Array).
 */
export function parseNavStackCookie(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  try {
    const arr = JSON.parse(value) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((e): e is string => typeof e === "string" && e.startsWith("/")).slice(-MAX_STACK_LEN);
  } catch {
    return [];
  }
}
