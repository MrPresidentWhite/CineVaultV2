/**
 * Status-Digest-Job: E-Mails an User mit Benachrichtigungs-Präferenzen
 * und Discord-Webhook für UPLOADED/ARCHIVED.
 * Läuft z. B. um 10:00 und 21:00 (Cron).
 */

import { prisma } from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { renderMovieNotificationHtml } from "@/lib/email-templates";
import { APP_URL, R2_PUBLIC_BASE_URL, DISCORD_WEBHOOK_URL } from "@/lib/env";
import type { Status } from "@/generated/prisma/enums";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const DIGEST_WINDOW_HOURS = 12;

const DISCORD_RELEVANT_STATUSES: Status[] = ["UPLOADED", "ARCHIVED"];
const DISCORD_TITLES: Partial<
  Record<Status, { single: string; plural: string }>
> = {
  UPLOADED: {
    single: "Folgender Film ist ab sofort verfügbar",
    plural: "Folgende Filme sind ab sofort verfügbar",
  },
  ARCHIVED: {
    single: "Folgender Film ist ab sofort archiviert",
    plural: "Folgende Filme sind ab sofort archiviert",
  },
};

function publicUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return "";
  const base = (R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  const path = key.replace(/^\/+/, "");
  return base ? `${base}/${path}` : path || "";
}

async function sendDiscordNotification(content: string, logLabel?: string): Promise<void> {
  if (!DISCORD_WEBHOOK_URL || !content.trim()) return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    console.log(`[digest] Discord: ${logLabel ?? content.slice(0, 50)}…`);
  } catch (err) {
    console.error("[digest] Discord-Webhook fehlgeschlagen:", err);
  }
}

export async function sendStatusDigestJob(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - DIGEST_WINDOW_HOURS * 60 * 60 * 1000
  );

  // 1. Änderungen der letzten 12h für E-Mails
  const recentChanges = await prisma.movieStatusChange.findMany({
    where: {
      changedAt: { gte: windowStart, lte: now },
      delivered: false,
    },
    select: {
      id: true,
      movieId: true,
      from: true,
      to: true,
      changedAt: true,
      movie: {
        select: {
          id: true,
          title: true,
          releaseYear: true,
          posterUrl: true,
          accentColor: true,
        },
      },
    },
    orderBy: { changedAt: "asc" },
  });

  // 2. Alle undelivered Changes für Discord (unabhängig von Zeit)
  const openChanges = await prisma.movieStatusChange.findMany({
    where: { delivered: false },
    select: {
      id: true,
      movieId: true,
      to: true,
      changedAt: true,
      movie: {
        select: { title: true, releaseYear: true },
      },
    },
  });

  // Discord: UPLOADED/ARCHIVED aus allen offenen Changes (pro Status eine Nachricht)
  const statusToMovies = new Map<Status, string[]>();
  DISCORD_RELEVANT_STATUSES.forEach((s) => statusToMovies.set(s, []));
  const seenMovies = new Set<number>();
  for (const change of openChanges) {
    if (seenMovies.has(change.movieId)) continue;
    seenMovies.add(change.movieId);
    const list = statusToMovies.get(change.to as Status);
    if (list) {
      list.push(`${change.movie.title} (${change.movie.releaseYear})`);
    }
  }
  for (const [status, movies] of statusToMovies) {
    if (movies.length === 0) continue;
    const config = DISCORD_TITLES[status];
    if (!config) continue;
    const title = movies.length === 1 ? config.single : config.plural;
    const content = `${title}\n\n${movies.map((m) => `> **${m}**`).join("\n")}`;
    await sendDiscordNotification(content, `${title} – ${movies.length} Filme`);
  }

  // E-Mails: nur wenn es recent Changes gibt und SMTP konfiguriert ist
  if (recentChanges.length > 0 && isEmailConfigured()) {
    const grouped = recentChanges.reduce<
      Record<
        number,
        { movie: (typeof recentChanges)[0]["movie"]; events: typeof recentChanges }
      >
    >((acc, change) => {
      if (!acc[change.movieId]) {
        acc[change.movieId] = { movie: change.movie, events: [] };
      }
      acc[change.movieId].events.push(change);
      return acc;
    }, {});

    const summaries = Object.values(grouped).map((group) => {
      const events = group.events.sort(
        (a, b) => a.changedAt.getTime() - b.changedAt.getTime()
      );
      const first = events[0];
      const last = events[events.length - 1];
      return {
        movie: group.movie,
        from: first.from,
        to: last.to,
        firstTime: format(first.changedAt, "dd.MM.yyyy, HH:mm 'Uhr'", { locale: de }),
        lastTime: format(last.changedAt, "dd.MM.yyyy, HH:mm 'Uhr'", { locale: de }),
        finalStatus: last.to,
      };
    });

    const users = await prisma.user.findMany({
      where: { notificationsEnabled: true },
      select: {
        id: true,
        email: true,
        name: true,
        statusPreferences: { select: { status: true } },
      },
    });

    for (const user of users) {
      const userStatuses = user.statusPreferences.map((p: { status: Status }) => p.status);
      if (userStatuses.length === 0) continue;
      const relevantSummaries = summaries.filter((s) =>
        userStatuses.includes(s.finalStatus as Status)
      );
      if (relevantSummaries.length === 0) continue;
      try {
        const html = renderMovieNotificationHtml(
          { name: user.name, email: user.email },
          relevantSummaries,
          APP_URL,
          publicUrl
        );
        await sendEmail({
          to: user.email,
          subject: `CineVault • Es wurden ${relevantSummaries.length} Film${relevantSummaries.length === 1 ? "" : "e"} aktualisiert.`,
          html,
        });
        console.log(`[digest] Mail gesendet an ${user.email}`);
      } catch (err) {
        console.error(`[digest] Mail-Fehler an ${user.email}:`, err);
      }
    }
  }

  // Alle betroffenen Changes als geliefert markieren
  const allIds = [
    ...recentChanges.map((c) => c.id),
    ...openChanges.map((c) => c.id),
  ];
  if (allIds.length > 0) {
    await prisma.movieStatusChange.updateMany({
      where: { id: { in: allIds } },
      data: { delivered: true, deliveredAt: now },
    });
    console.log(`[digest] ${allIds.length} Changes als geliefert markiert`);
  } else {
    console.log("[digest] Keine Changes zum Verarbeiten");
  }
}
