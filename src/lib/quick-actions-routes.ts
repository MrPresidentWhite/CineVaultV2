/**
 * Erlaubte Routen für Quick Actions (basierend auf existierenden App-Routen).
 * Sichtbarkeit wird über minRole gesteuert. Optionale Filter (z. B. Status)
 * können pro Route definiert werden und erscheinen dynamisch im Formular.
 */

import type { Role, Status } from "@/generated/prisma/enums";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { statusLabels } from "@/lib/enum-mapper";

export type RouteFilterOption = { value: string; label: string };

export type RouteFilter = {
  param: string;
  label: string;
  /** Einzelauswahl (z. B. Status) oder Mehrfachauswahl. */
  multi?: boolean;
  options: RouteFilterOption[];
};

export type QuickActionRoute = {
  href: string;
  label: string;
  minRole: Role;
  /** Optionale Filter – wenn gesetzt, erscheinen Checkboxen beim Auswählen dieser Route. */
  filters?: RouteFilter[];
};

const ROLE_ORDER: Role[] = [RoleEnum.VIEWER, RoleEnum.EDITOR, RoleEnum.ADMIN];

function roleLevel(role: Role): number {
  return ROLE_ORDER.indexOf(role);
}

/** Mindestrolle erfüllt? (userRole >= minRole) */
export function canAccessRoute(userRole: Role, minRole: Role): boolean {
  return roleLevel(userRole) >= roleLevel(minRole);
}

const MOVIE_STATUS_FILTER: RouteFilter = {
  param: "status",
  label: "Status",
  multi: false,
  options: (Object.entries(statusLabels) as [Status, string][]).map(
    ([value, label]) => ({ value, label })
  ),
};

const COLLECTION_SORT_FILTER: RouteFilter = {
  param: "sort",
  label: "Sortierung",
  multi: false,
  options: [
    { value: "created_desc", label: "Neueste zuerst" },
    { value: "created_asc", label: "Älteste zuerst" },
    { value: "name_asc", label: "Name A–Z" },
    { value: "name_desc", label: "Name Z–A" },
    { value: "count_desc", label: "Meiste Filme" },
    { value: "count_asc", label: "Wenigste Filme" },
  ],
};

const COLLECTION_HAS_POSTER_FILTER: RouteFilter = {
  param: "hasPoster",
  label: "Poster",
  multi: false,
  options: [
    { value: "any", label: "— egal —" },
    { value: "yes", label: "vorhanden" },
    { value: "no", label: "fehlt" },
  ],
};

const COLLECTION_HAS_COVER_FILTER: RouteFilter = {
  param: "hasCover",
  label: "Cover",
  multi: false,
  options: [
    { value: "any", label: "— egal —" },
    { value: "yes", label: "vorhanden" },
    { value: "no", label: "fehlt" },
  ],
};

const COLLECTION_HAS_BACKDROP_FILTER: RouteFilter = {
  param: "hasBackdrop",
  label: "Backdrop",
  multi: false,
  options: [
    { value: "any", label: "— egal —" },
    { value: "yes", label: "vorhanden" },
    { value: "no", label: "fehlt" },
  ],
};

const COLLECTION_MIN_ONE_MOVIE_FILTER: RouteFilter = {
  param: "minOneMovie",
  label: "Mindestens 1 Film",
  multi: false,
  options: [
    { value: "", label: "— egal —" },
    { value: "1", label: "ja, nur mit mind. 1 Film" },
  ],
};

/**
 * Alle für Quick Actions erlaubten Routen (existierende App-Routen + Mindestrolle).
 * Routen mit filters erscheinen einmal im Dropdown; beim Auswählen können Filter per Checkbox angefügt werden.
 */
export const QUICK_ACTION_ROUTES: QuickActionRoute[] = [
  { href: "/", label: "Startseite", minRole: RoleEnum.VIEWER },
  {
    href: "/movies",
    label: "Filme",
    minRole: RoleEnum.VIEWER,
    filters: [MOVIE_STATUS_FILTER],
  },
  {
    href: "/collections",
    label: "Sammlungen",
    minRole: RoleEnum.VIEWER,
    filters: [
      COLLECTION_SORT_FILTER,
      COLLECTION_HAS_POSTER_FILTER,
      COLLECTION_HAS_COVER_FILTER,
      COLLECTION_HAS_BACKDROP_FILTER,
      COLLECTION_MIN_ONE_MOVIE_FILTER,
    ],
  },
  { href: "/series", label: "Serien", minRole: RoleEnum.VIEWER },
  { href: "/dashboard", label: "Dashboard – Übersicht", minRole: RoleEnum.VIEWER },
  { href: "/dashboard/stats", label: "Dashboard – Statistiken", minRole: RoleEnum.VIEWER },
  { href: "/dashboard/profile", label: "Dashboard – Profil", minRole: RoleEnum.VIEWER },
  { href: "/dashboard/profile/quick-actions", label: "Dashboard – Quick Actions", minRole: RoleEnum.VIEWER },
  { href: "/dashboard/profile/devices", label: "Dashboard – Angemeldete Geräte", minRole: RoleEnum.VIEWER },
  { href: "/dashboard/profile/notifications", label: "Dashboard – E-Mail-Benachrichtigungen", minRole: RoleEnum.VIEWER },
  { href: "/dashboard/account", label: "Dashboard – Passwort ändern", minRole: RoleEnum.VIEWER },
  { href: "/dashboard/import/movies", label: "Import – Filme", minRole: RoleEnum.EDITOR },
  { href: "/dashboard/import/series", label: "Import – Serien", minRole: RoleEnum.EDITOR },
  { href: "/dashboard/admin/users", label: "Admin – Benutzerverwaltung", minRole: RoleEnum.ADMIN },
];

/**
 * Gibt die Routen zurück, die der User mit seiner Rolle nutzen darf.
 * Für das URL-Dropdown in den Quick-Actions-Einstellungen.
 */
export function getRoutesForUser(userRole: Role): QuickActionRoute[] {
  return QUICK_ACTION_ROUTES.filter((r) => canAccessRoute(userRole, r.minRole));
}

/** Basis-Pfad ohne Query-String (für Zuordnung zur Route). */
export function getBasePath(href: string): string {
  const i = href.indexOf("?");
  return i === -1 ? href : href.slice(0, i);
}

/**
 * Findet die Route, die zu einer href gehört (Vergleich über Basis-Pfad).
 */
export function findRouteByHref(href: string): QuickActionRoute | undefined {
  const base = getBasePath(href);
  return QUICK_ACTION_ROUTES.find((r) => r.href === base);
}

/**
 * Parst Query-Parameter aus einer href (Mehrfachwerte als Array).
 * z. B. /movies?status=PROCESSING → { status: ["PROCESSING"] }
 */
export function parseHrefParams(href: string): Record<string, string[]> {
  const i = href.indexOf("?");
  if (i === -1) return {};
  const params: Record<string, string[]> = {};
  const sp = new URLSearchParams(href.slice(i + 1));
  sp.forEach((_value, key) => {
    params[key] = sp.getAll(key);
  });
  return params;
}

/**
 * Baut href aus Basis-Pfad und ausgewählten Filter-Werten.
 */
export function buildHrefWithParams(
  basePath: string,
  params: Record<string, string | string[]>
): string {
  const sp = new URLSearchParams();
  for (const [key, values] of Object.entries(params)) {
    const arr = Array.isArray(values) ? values : values ? [values] : [];
    for (const v of arr) {
      if (v) sp.append(key, v);
    }
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Prüft, ob der User eine gespeicherte href anzeigen darf (Route existiert und Rolle reicht).
 */
export function canUserAccessHref(href: string, userRole: Role): boolean {
  const route = findRouteByHref(href);
  if (!route) return false;
  return canAccessRoute(userRole, route.minRole);
}
