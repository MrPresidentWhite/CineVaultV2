/**
 * Quick Actions: Default-Liste, Typen, Accent aus Emoji.
 * Sichtbarkeit wird über Routen-Berechtigung gesteuert (siehe quick-actions-routes).
 */

import type { Role } from "@/generated/prisma/enums";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { canUserAccessHref } from "@/lib/quick-actions-routes";

export type QuickActionItem = {
  href: string;
  title: string;
  desc: string;
  icon: string;
  accent: string;
  /** Nur bei Default-Liste gesetzt; gespeicherte Einträge haben keine Rollen – Sichtbarkeit folgt der Route. */
  roles?: Role[];
};

/** Default-Quick-Actions (alte Anordnung, URLs an neue Dashboard-Struktur angepasst). */
export const DEFAULT_QUICK_ACTIONS: QuickActionItem[] = [
  {
    href: "/dashboard/import/movies",
    title: "Film importieren",
    desc: "TMDb suchen & anlegen",
    icon: "📥",
    accent: "#7DD3FC",
    roles: [RoleEnum.EDITOR, RoleEnum.ADMIN],
  },
  {
    href: "/movies",
    title: "Filme",
    desc: "Filme & Sammlungen finden",
    icon: "🔎",
    accent: "#93C5FD",
    roles: [RoleEnum.VIEWER, RoleEnum.EDITOR, RoleEnum.ADMIN],
  },
  {
    href: "/movies?status=PROCESSING",
    title: "Filme in Verarbeitung",
    desc: "Zeige Filme in Verarbeitung",
    icon: "🛠️",
    accent: "#93C5FD",
    roles: [RoleEnum.VIEWER, RoleEnum.EDITOR, RoleEnum.ADMIN],
  },
  {
    href: "/collections",
    title: "Sammlungen",
    desc: "Reihen & Boxsets ansehen",
    icon: "📂",
    accent: "#FDE68A",
    roles: [RoleEnum.VIEWER, RoleEnum.EDITOR, RoleEnum.ADMIN],
  },
  {
    href: "/dashboard/profile",
    title: "Profil",
    desc: "Deine Daten & Avatar",
    icon: "👤",
    accent: "#86EFAC",
    roles: [RoleEnum.VIEWER, RoleEnum.EDITOR, RoleEnum.ADMIN],
  },
  {
    href: "/dashboard/admin/users",
    title: "Benutzer",
    desc: "Verwalten & Rechte",
    icon: "👥",
    accent: "#FCA5A5",
    roles: [RoleEnum.ADMIN],
  },
];

/** Palette für Accent-Farben (aus Emoji abgeleitet). */
const ACCENT_PALETTE = [
  "#7DD3FC",
  "#93C5FD",
  "#A5B4FC",
  "#C4B5FD",
  "#FDE68A",
  "#FCD34D",
  "#86EFAC",
  "#6EE7B7",
  "#FCA5A5",
  "#F87171",
  "#FDA4AF",
  "#F9A8D4",
];

/**
 * Leitet eine Accent-Farbe aus dem Emoji ab (stabiler Hash auf Zeichencode).
 */
export function getAccentFromEmoji(emoji: string): string {
  if (!emoji) return ACCENT_PALETTE[0];
  let n = 0;
  for (let i = 0; i < emoji.length; i++) {
    n = (n * 31 + emoji.codePointAt(i)!) >>> 0;
  }
  return ACCENT_PALETTE[Math.abs(n) % ACCENT_PALETTE.length];
}

/**
 * Gibt die Quick-Actions-Liste für einen User zurück.
 * Nutzt gespeicherte Liste aus quickActionsJson oder Default.
 * Sichtbarkeit: nur Einträge, deren Route der User berechtigungsmäßig sehen darf.
 */
export function getQuickActionsForUser(
  quickActionsJson: string | null,
  userRole: Role
): QuickActionItem[] {
  let list: QuickActionItem[];
  if (quickActionsJson?.trim()) {
    try {
      const parsed = JSON.parse(quickActionsJson) as QuickActionItem[];
      if (Array.isArray(parsed)) {
        list = parsed.map((a) => ({
          ...a,
          accent: a.accent || getAccentFromEmoji(a.icon),
        }));
      } else {
        list = DEFAULT_QUICK_ACTIONS;
      }
    } catch {
      list = DEFAULT_QUICK_ACTIONS;
    }
  } else {
    list = DEFAULT_QUICK_ACTIONS;
  }
  return list.filter((a) => canUserAccessHref(a.href, userRole));
}

/**
 * Parst die gespeicherte JSON-Liste für die Bearbeitung.
 * Gespeichert werden nur href, title, desc, icon, accent – keine Rollen.
 */
export function parseStoredQuickActions(quickActionsJson: string | null): QuickActionItem[] {
  if (!quickActionsJson?.trim()) return [...DEFAULT_QUICK_ACTIONS];
  try {
    const parsed = JSON.parse(quickActionsJson) as QuickActionItem[];
    if (!Array.isArray(parsed)) return [...DEFAULT_QUICK_ACTIONS];
    return parsed.map((a) => ({
      href: a.href ?? "",
      title: a.title ?? "",
      desc: a.desc ?? "",
      icon: a.icon ?? "🔗",
      accent: a.accent || getAccentFromEmoji(a.icon ?? "🔗"),
    }));
  } catch {
    return [...DEFAULT_QUICK_ACTIONS];
  }
}
