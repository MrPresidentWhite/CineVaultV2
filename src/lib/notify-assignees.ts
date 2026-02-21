/**
 * Benachrichtigung der weiteren Zugewiesenen (Wunschliste), nur wenn der
 * Status von „Auf Wunschliste“ (VB_WISHLIST) auf „Im Versand“ (SHIPPING) wechselt (Issue #3).
 * Nutzt das eigene Template „Zustellbenachrichtigung“ mit Filmkarten, Videobuster-Link
 * und tokenbasiertem „Im Browser anzeigen“-Link.
 */

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import {
  renderWishlistDeliveryNotificationHtml,
  type WishlistDeliveryMovie,
} from "@/lib/email-templates";
import { APP_URL, R2_PUBLIC_BASE_URL } from "@/lib/env";

const VIEW_IN_BROWSER_DAYS = 7;

function publicUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  const base = (R2_PUBLIC_BASE_URL || APP_URL || "").replace(/\/+$/, "");
  const path = key.replace(/^\/+/, "");
  return base ? `${base}/${path}` : "";
}

/**
 * Sendet an alle weiteren Zugewiesenen des Films die Zustellbenachrichtigung.
 * Wird nur aufgerufen, wenn der Status von VB_WISHLIST auf SHIPPING wechselt.
 * Erstellt pro Empfänger einen DigestViewToken für „Im Browser öffnen“.
 */
export async function notifyAdditionalAssigneesOnShipping(movieId: number): Promise<void> {
  if (!isEmailConfigured()) return;

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: {
      id: true,
      title: true,
      releaseYear: true,
      posterUrl: true,
      accentColor: true,
      videobusterUrl: true,
      additionalAssignees: {
        select: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              notificationsEnabled: true,
            },
          },
        },
      },
    },
  });
  if (!movie || movie.additionalAssignees.length === 0) return;

  const wishlistMovie: WishlistDeliveryMovie = {
    id: movie.id,
    title: movie.title,
    releaseYear: movie.releaseYear,
    posterUrl: movie.posterUrl,
    accentColor: movie.accentColor,
    videobusterUrl: movie.videobusterUrl,
  };
  const appUrl = APP_URL.replace(/\/+$/, "");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VIEW_IN_BROWSER_DAYS * 24 * 60 * 60 * 1000);

  for (const { user } of movie.additionalAssignees) {
    if (!user.notificationsEnabled || !user.email?.trim()) continue;

    try {
      const token = randomBytes(24).toString("base64url");
      const viewInBrowserUrl = `${appUrl}/digest/view/${token}`;

      const html = renderWishlistDeliveryNotificationHtml(
        { name: user.name, email: user.email },
        [wishlistMovie],
        appUrl,
        publicUrl,
        viewInBrowserUrl
      );

      await prisma.digestViewToken.create({
        data: { token, html, userId: user.id, expiresAt },
      });

      await sendEmail({
        to: user.email,
        subject: `CineVault – Zustellung: ${movie.title} (${movie.releaseYear}) ist unterwegs`,
        html,
      });
    } catch (err) {
      console.error("[notify-assignees] E-Mail-Fehler für User", user.id, err);
    }
  }
}
