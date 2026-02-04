/**
 * Labels für Prisma-Enums (UI-Anzeige).
 * Import aus dem generierten Prisma-Client.
 */

import type {
  Genre,
  MediaType,
  PreferenceMode,
  Priority,
  Role,
  Status,
  TVGenre,
} from "@/generated/prisma/enums";

export const statusLabels: Record<Status, string> = {
  ON_WATCHLIST: "Auf Merkliste",
  VO_UNKNOWN: "VÖ: Unbekannt",
  VO_SOON: "VÖ: Demnächst",
  VB_WISHLIST: "Auf Wunschliste",
  SHIPPING: "Im Versand",
  PROCESSING: "In Verarbeitung",
  UPLOADED: "Hochgeladen",
  ARCHIVED: "Archiviert",
};

export const priorityLabels: Record<Priority, string> = {
  HIGH: "Hoch",
  STANDARD: "Standard",
  LOW: "Niedrig",
};

export const mediaTypeLabels: Record<MediaType, string> = {
  UHD_4K: "4K UHD",
  BLURAY: "Blu-Ray",
  DVD: "DVD",
};

export const genreLabels: Record<Genre, string> = {
  DRAMA: "Drama",
  KOMOEDIE: "Komödie",
  THRILLER: "Thriller",
  SERIE: "Serie",
  KRIMI: "Krimi",
  HORROR: "Horror",
  ACTION: "Action",
  DOKU: "Dokumentation",
  ADULT_18: "18+ Spielfilm",
  DEUTSCHER_FILM: "Deutscher Film",
  ABENTEUER: "Abenteuer",
  LOVESTORY: "Lovestory",
  FANTASY: "Fantasy",
  KIDS: "Kids",
  ANIMATION: "Animation",
  SCIFI: "Science-Fiction",
  TV_FILM: "TV-Film",
  KRIEGSFILM: "Kriegsfilm",
  MUSIK: "Musik",
  WESTERN: "Western",
  RATGEBER: "Ratgeber",
  ANIME: "Anime",
  BOLLYWOOD: "Bollywood",
};

export const genreLabelsTV: Record<TVGenre, string> = {
  ACTION_ADVENTURE: "Action & Adventure",
  ANIMATION: "Animation",
  KOMOEDIE: "Komödie",
  KRIMI: "Krimi",
  DOKUMENTARFILM: "Dokumentarfilm",
  DRAMA: "Drama",
  FAMILIE: "Familie",
  KIDS: "Kids",
  MYSTERY: "Mystery",
  NEWS: "News",
  REALITY: "Reality",
  SCIFI_FANTASY: "Sci-Fi & Fantasy",
  SOAP: "Soap",
  TALK: "Talk",
  WAR_POLITICS: "War & Politics",
  WESTERN: "Western",
};

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administrator",
  EDITOR: "Bearbeiter",
  VIEWER: "Betrachter",
};

export const preferenceModeLabels: Record<PreferenceMode, string> = {
  EXCLUDE: "Ausgeschlossen",
};

/** Einzelwert-Helper (null/undefined-sicher). */
export function statusLabel(s: Status | null | undefined): string {
  return s ? statusLabels[s] : "";
}
export function priorityLabel(p: Priority | null | undefined): string {
  return p ? priorityLabels[p] : "";
}
export function mediaTypeLabel(m: MediaType | null | undefined): string {
  return m ? mediaTypeLabels[m] : "";
}
export function genreLabel(g: Genre | null | undefined): string {
  return g ? genreLabels[g] : "";
}
export function genreLabelTV(g: TVGenre | null | undefined): string {
  return g ? genreLabelsTV[g] : "";
}
export function roleLabel(r: Role | null | undefined): string {
  return r ? roleLabels[r] : "";
}
export function preferenceModeLabel(m: PreferenceMode | null | undefined): string {
  return m ? preferenceModeLabels[m] : "";
}
