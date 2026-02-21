/**
 * E-Mail-HTML-Templates (inline CSS, tabellenbasiertes Layout für maximale Mail-Client-Kompatibilität).
 * Kein EJS – reine TS-Funktionen für bessere Typen und Wartung.
 * Alle Bild-URLs müssen absolut sein (publicUrl mit APP_URL/R2_PUBLIC_BASE_URL).
 * Logo: PNG erforderlich (SVG wird von Gmail/Outlook blockiert) – uploads/assets/logo-big.png oder /assets/logo-big.png.
 */

import { format } from "date-fns";
import { de } from "date-fns/locale";
import { statusLabels } from "./enum-mapper";
import type { Status } from "@/generated/prisma/enums";
import { Status as StatusEnum } from "@/generated/prisma/enums";

// Reihenfolge der Kategorien in der Mail (wichtigste / „finalste“ zuerst)
const STATUS_DISPLAY_ORDER: Status[] = [
  StatusEnum.RECENTLY_ADDED,
  StatusEnum.UPLOADED,
  StatusEnum.ARCHIVED,
  StatusEnum.SHIPPING,
  StatusEnum.PROCESSING,
  StatusEnum.VO_SOON,
  StatusEnum.ON_WATCHLIST,
  StatusEnum.VB_WISHLIST,
  StatusEnum.VO_UNKNOWN,
];

// Design-Tokens wie globals.css
const styles = {
  bg: "#0d0d0d",
  panel: "#141414",
  text: "#eaeaea",
  textMuted: "#ccc",
  textDim: "#888",
  gold: "#ffd700",
  ring: "#2a2a2a",
  goldBg: "rgba(255,215,0,.12)",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusLabel(s: Status | string): string {
  return statusLabels[s as Status] ?? String(s);
}

function filmCountLabel(count: number): string {
  return count === 1 ? "1 Film" : `${count} Filme`;
}

export type DigestStep = {
  status: Status | string;
  time: string;
  scheduledAt?: Date | null;
};

export type DigestSummary = {
  movie: {
    id: number;
    title: string;
    releaseYear: number;
    posterUrl: string | null;
    accentColor: string | null;
  };
  from: Status | string;
  to: Status | string;
  finalStatus: Status | string;
  /** Bei from=VO_SOON: geplantes Datum für E-Mail „VÖ: Demnächst (Datum)“ */
  fromScheduledAt?: Date | null;
  /** Gefilterte Zwischenschritte (1. …, 2. …, 3. …) */
  steps: DigestStep[];
};

export type DigestUser = {
  name: string | null;
  email: string;
};

/** Film für die Wunschlisten-Zustellmail (nur bei Status „Im Versand“). */
export type WishlistDeliveryMovie = {
  id: number;
  title: string;
  releaseYear: number;
  posterUrl: string | null;
  accentColor: string | null;
  videobusterUrl: string | null;
};

function stepLabelForEmail(step: DigestStep): string {
  if (step.status === StatusEnum.VO_SOON && step.scheduledAt) {
    const dateStr = format(new Date(step.scheduledAt), "d. MMMM yyyy", {
      locale: de,
    });
    return `VÖ: Demnächst (${dateStr})`;
  }
  return statusLabel(step.status);
}

function renderMovieCard(
  s: DigestSummary,
  appUrl: string,
  publicUrl: (key: string) => string
): string {
  const accent = s.movie.accentColor || styles.gold;
  const posterSrc = s.movie.posterUrl ? publicUrl(s.movie.posterUrl) : "";
  const hasPoster = Boolean(posterSrc);
  const stepsHtml =
    s.steps.length > 0
      ? s.steps
          .map(
            (st, i) =>
              `${i + 1}. ${esc(st.time)} <strong style="color:${styles.gold}">„${esc(stepLabelForEmail(st))}"</strong>`
          )
          .join("<br>")
      : `${esc(s.from)} → ${esc(statusLabel(s.to))}`;
  const posterCell = hasPoster
    ? `<td width="140" valign="top" style="padding:0 16px 0 0;vertical-align:top;"><img src="${esc(posterSrc)}" alt="${esc(s.movie.title)}" width="140" height="210" style="display:block;width:140px;height:210px;border:0;border-radius:8px;background:${styles.ring};" /></td>`
    : "";
  const bodyCell = `<td valign="top" style="padding:16px;vertical-align:top;">
    <div style="font-size:18px;font-weight:600;color:${styles.gold};margin-bottom:8px;">${esc(s.movie.title)} <span style="font-size:14px;color:#aaa;">(${s.movie.releaseYear})</span></div>
    <div style="font-size:14px;margin:10px 0;padding:10px;background:${styles.goldBg};border-radius:8px;color:${styles.text};line-height:1.8;">
      ${stepsHtml}
    </div>
    <a href="${esc(appUrl)}/movies/${String(s.movie.id)}" style="display:inline-block;padding:9px 16px;border-radius:8px;font-weight:600;font-size:13px;margin-top:12px;background:${accent};color:#000;text-decoration:none;">Zur Detailseite</a>
  </td>`;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${styles.panel};border:1px solid ${styles.ring};border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${posterCell}${bodyCell}</tr></table>
      </td></tr>
    </table>`;
}

export function renderMovieNotificationHtml(
  user: DigestUser,
  summaries: DigestSummary[],
  appUrl: string,
  publicUrl: (key: string) => string,
  /** Wenn gesetzt: Link „Im Browser öffnen“ anzeigen (gleiche Inhalte wie E-Mail). */
  viewInBrowserUrl?: string
): string {
  const userName = user.name?.trim() || user.email;
  // PNG von CDN (uploads/assets/logo-big.png); Fallback auf App-Static oder Text
  const logoUrl =
    publicUrl("uploads/assets/logo-big.png") ||
    `${appUrl.replace(/\/+$/, "")}/assets/logo-big.png`;
  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="CineVault" width="180" height="34" style="display:block;width:180px;height:34px;margin:0 auto 10px;border:0;max-width:100%;" />`
    : `<span style="font-size:20px;font-weight:700;color:${styles.gold};">CineVault</span>`;

  const byStatus = summaries.reduce<Record<string, DigestSummary[]>>((acc, s) => {
    const status = String(s.finalStatus);
    if (!acc[status]) acc[status] = [];
    acc[status].push(s);
    return acc;
  }, {});

  const orderedStatuses = [
    ...STATUS_DISPLAY_ORDER.filter((status) => (byStatus[status]?.length ?? 0) > 0),
    ...Object.keys(byStatus).filter((status) => !STATUS_DISPLAY_ORDER.includes(status as Status)),
  ];

  const categorySummaryLines = orderedStatuses
    .map((status) => {
      const items = byStatus[status] ?? [];
      if (items.length === 0) return "";
      return `- ${statusLabel(status)}: ${filmCountLabel(items.length)}`;
    })
    .filter(Boolean)
    .join("<br>");

  const categorySections = orderedStatuses
    .map((status) => {
      const items = byStatus[status] ?? [];
      if (items.length === 0) return "";
      const label = statusLabel(status);
      const countText = filmCountLabel(items.length);
      const cards = items.map((s) => renderMovieCard(s, appUrl, publicUrl)).join("");
      return `
    <div class="category" style="margin-bottom:28px;">
      <h3 style="font-size:15px;font-weight:600;color:${styles.gold};margin:0 0 12px 0;padding-bottom:6px;border-bottom:1px solid ${styles.ring};">${esc(label)} (${esc(countText)})</h3>
      <div class="category-movies" style="margin:0;">${cards}</div>
    </div>`;
    })
    .join("");

  const inlineStyleBlock = `
body { margin:0; padding:0; font-family:Arial,Helvetica,sans-serif; background:${styles.bg}; color:${styles.text}; line-height:1.5; font-size:15px; -webkit-text-size-adjust:100%; }
a { color:${styles.gold}; }
img { border:0; }
`;
  const viewInBrowserBar = viewInBrowserUrl
    ? `<tr><td align="center" style="padding:8px 16px;background:${styles.ring};font-size:12px;color:${styles.textDim};">
  E-Mail wird nicht richtig angezeigt? <a href="${esc(viewInBrowserUrl)}" style="color:${styles.gold};text-decoration:underline;">Im Browser öffnen</a>
</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting" content="yes">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>CineVault – ${summaries.length} ${summaries.length === 1 ? "Film" : "Filme"} geändert</title>
  <style type="text/css">${inlineStyleBlock}</style>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:${styles.bg};color:${styles.text};line-height:1.5;font-size:15px;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${styles.bg};">
    ${viewInBrowserBar}
    <tr><td align="center" style="padding:16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="660" style="max-width:660px;">
        <tr><td style="text-align:center;padding-bottom:28px;">
          ${logoHtml}
          <span style="color:${styles.textDim};font-size:13px;">Film-Status Update</span>
        </td></tr>
        <tr><td style="padding:0 0 12px 0;">
          <h2 style="font-size:19px;margin:0 0 12px 0;color:${styles.text};font-weight:600;">Hallo ${esc(userName)},</h2>
          <p style="margin:10px 0;font-size:14px;color:${styles.textMuted};">Hier die wichtigsten Statusänderungen der letzten 24 Stunden, nach Status sortiert:</p>
          ${categorySummaryLines ? `<p style="margin:12px 0 20px 0;font-size:14px;color:${styles.textMuted};line-height:1.6;">${categorySummaryLines}</p>` : ""}
        </td></tr>
        <tr><td style="padding:24px 0;">
          ${categorySections}
        </td></tr>
        <tr><td style="padding-top:36px;border-top:1px solid ${styles.ring};font-size:12px;color:#777;text-align:center;">
          <p style="margin:0 0 8px;">Du kannst diese Benachrichtigungen in deinem Profil deaktivieren.</p>
          <p style="margin:0;">© CineVault – automatische Benachrichtigung</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderWishlistMovieCard(
  movie: WishlistDeliveryMovie,
  appUrl: string,
  publicUrl: (key: string) => string
): string {
  const accent = movie.accentColor || styles.gold;
  const posterSrc = movie.posterUrl ? publicUrl(movie.posterUrl) : "";
  const hasPoster = Boolean(posterSrc);
  const posterCell = hasPoster
    ? `<td width="140" valign="top" style="padding:0 16px 0 0;vertical-align:top;"><img src="${esc(posterSrc)}" alt="${esc(movie.title)}" width="140" height="210" style="display:block;width:140px;height:210px;border:0;border-radius:8px;background:${styles.ring};" /></td>`
    : "";
  const vbLink = movie.videobusterUrl
    ? `<a href="${esc(movie.videobusterUrl)}" style="display:inline-block;padding:9px 16px;border-radius:8px;font-weight:600;font-size:13px;margin-top:8px;background:${accent};color:#000;text-decoration:none;">Bei Videobuster ansehen</a>`
    : "";
  const bodyCell = `<td valign="top" style="padding:16px;vertical-align:top;">
    <div style="font-size:18px;font-weight:600;color:${styles.gold};margin-bottom:8px;">${esc(movie.title)} <span style="font-size:14px;color:${styles.textDim};">(${movie.releaseYear})</span></div>
    <div style="margin-top:12px;">${vbLink}</div>
  </td>`;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${styles.panel};border:1px solid ${styles.ring};border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${posterCell}${bodyCell}</tr></table>
      </td></tr>
    </table>`;
}

/**
 * E-Mail-Template: Zustellung an Wunschlisten-Nutzer (nur bei Status „Im Versand“).
 * Eigenes Layout mit „Dem User … werden folgende Filme zugestellt“, Filmkarten wie in den
 * normalen Notifications, Hinweis zur Videobuster-Wunschliste und Videobuster-Link pro Film.
 * Optional: viewInBrowserUrl für tokenbasierten „Im Browser öffnen“-Link.
 */
export function renderWishlistDeliveryNotificationHtml(
  user: DigestUser,
  movies: WishlistDeliveryMovie[],
  appUrl: string,
  publicUrl: (key: string) => string,
  viewInBrowserUrl?: string
): string {
  const userName = user.name?.trim() || user.email || "Nutzer";
  const logoUrl =
    publicUrl("uploads/assets/logo-big.png") ||
    `${appUrl.replace(/\/+$/, "")}/assets/logo-big.png`;
  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="CineVault" width="180" height="34" style="display:block;width:180px;height:34px;margin:0 auto 10px;border:0;max-width:100%;" />`
    : `<span style="font-size:20px;font-weight:700;color:${styles.gold};">CineVault</span>`;

  const cardsHtml = movies.map((m) => renderWishlistMovieCard(m, appUrl, publicUrl)).join("");

  const introText =
    movies.length === 1
      ? `Der Film <strong>${esc(movies[0].title)} (${movies[0].releaseYear})</strong> wird demnächst dem User <strong>${esc(userName)}</strong> zugestellt.`
      : `Folgende Filme werden demnächst dem User <strong>${esc(userName)}</strong> zugestellt:`;

  const inlineStyleBlock = `
body { margin:0; padding:0; font-family:Arial,Helvetica,sans-serif; background:${styles.bg}; color:${styles.text}; line-height:1.5; font-size:15px; -webkit-text-size-adjust:100%; }
a { color:${styles.gold}; text-decoration:none; }
img { border:0; display:block; }
table { border-collapse:collapse; }
`;
  const viewInBrowserBar = viewInBrowserUrl
    ? `<tr><td align="center" style="padding:8px 16px;background:${styles.ring};font-size:12px;color:${styles.textDim};">
  E-Mail wird nicht richtig angezeigt? <a href="${esc(viewInBrowserUrl)}" style="color:${styles.gold};text-decoration:underline;">Im Browser öffnen</a>
</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting" content="yes">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>CineVault – Zustellung: ${movies.length} ${movies.length === 1 ? "Film" : "Filme"} unterwegs</title>
  <style type="text/css">${inlineStyleBlock}</style>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:${styles.bg};color:${styles.text};line-height:1.5;font-size:15px;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${styles.bg};">
    ${viewInBrowserBar}
    <tr><td align="center" style="padding:16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="660" style="max-width:100%;width:660px;">
        <tr><td style="text-align:center;padding-bottom:28px;">
          ${logoHtml}
          <span style="color:${styles.textDim};font-size:13px;">Zustellbenachrichtigung</span>
        </td></tr>
        <tr><td style="padding:0 0 12px 0;">
          <h2 style="font-size:19px;margin:0 0 12px 0;color:${styles.text};font-weight:600;">Hallo ${esc(userName)},</h2>
          <p style="margin:10px 0;font-size:14px;color:${styles.textMuted};line-height:1.6;">${introText}</p>
        </td></tr>
        <tr><td style="padding:24px 0;">
          ${cardsHtml}
        </td></tr>
        <tr><td style="padding:0 0 20px 0;">
          <p style="margin:0;font-size:14px;color:${styles.textMuted};line-height:1.6;">Bitte entferne die Filme aus deiner Videobuster-Wunschliste, damit es zu keinen unnötigen Doppeltzustellungen kommt.</p>
        </td></tr>
        <tr><td style="padding-top:36px;border-top:1px solid ${styles.ring};font-size:12px;color:${styles.textDim};text-align:center;">
          <p style="margin:0;">© CineVault – automatische Zustellbenachrichtigung</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
