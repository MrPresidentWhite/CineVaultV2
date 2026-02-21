/**
 * Benachrichtigung der weiteren Zugewiesenen (Wunschliste), wenn ein Film
 * in „Im Versand“ oder einen späteren Status wechselt (Issue #3).
 */

import { prisma } from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { statusLabels } from "@/lib/enum-mapper";
import { APP_URL } from "@/lib/env";
import type { Status } from "@/generated/prisma/enums";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sendet eine E-Mail an alle weiteren Zugewiesenen des Films, sofern sie
 * Benachrichtigungen aktiviert haben. Inhalt: Film ist jetzt [Status], bitte
 * von der Wunschliste entfernen.
 */
export async function notifyAdditionalAssigneesOnStatusChange(
  movieId: number,
  newStatus: Status
): Promise<void> {
  if (!isEmailConfigured()) return;

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: {
      title: true,
      releaseYear: true,
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

  const statusLabel = statusLabels[newStatus] ?? newStatus;
  const titleEsc = esc(`${movie.title} (${movie.releaseYear})`);

  for (const { user } of movie.additionalAssignees) {
    if (!user.notificationsEnabled || !user.email?.trim()) continue;

    const userName = (user.name?.trim() || user.email || "Nutzer").replace(/</g, "");
    const movieUrl = `${APP_URL.replace(/\/+$/, "")}/movies/${movieId}`;
    const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>CineVault – Film-Status</title></head>
<body style="font-family:Arial,sans-serif;line-height:1.5;color:#333;max-width:560px;">
  <p>Hallo ${esc(userName)},</p>
  <p>Der Film <strong>${titleEsc}</strong> wurde auf den Status <strong>${esc(statusLabel)}</strong> gesetzt.</p>
  <p>Bitte entferne den Film von deiner Wunschliste, um eine Mehrfachzustellung zu vermeiden.</p>
  <p><a href="${esc(movieUrl)}" style="color:#ffd700;">Film in CineVault öffnen</a></p>
  <p style="margin-top:24px;font-size:12px;color:#666;">Diese E-Mail wurde automatisch von CineVault versendet.</p>
</body>
</html>`;

    try {
      await sendEmail({
        to: user.email,
        subject: `CineVault – ${movie.title} (${movie.releaseYear}): jetzt ${statusLabel}`,
        html,
      });
    } catch (err) {
      console.error("[notify-assignees] E-Mail-Fehler für User", user.id, err);
    }
  }
}
