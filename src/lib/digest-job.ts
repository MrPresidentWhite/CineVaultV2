/**
 * Status digest job: E-Mails an User mit Benachrichtigungs-Einstellungen
 * und Discord-Webhook nur für UPLOADED/ARCHIVED.
 * Läuft z. B. um 10:00 und 21:00 (Cron).
 */

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import {
  renderMovieNotificationHtml,
  type DigestSummary,
} from "@/lib/email-templates";
import { APP_URL, DISCORD_WEBHOOK_URL, R2_PUBLIC_BASE_URL } from "@/lib/env";
import type { Status } from "@/generated/prisma/enums";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const DIGEST_WINDOW_HOURS = 12;

/** Minutes: changes close together = burst, keep only last */
const STEP_BURST_MINUTES = 5;
/** Max steps per movie (then 1, 2, "...", n-1, n) */
const MAX_STEPS = 7;

/** Days: "Open in browser" link valid */
const VIEW_IN_BROWSER_DAYS = 7;

/** Discord: nur UPLOADED und ARCHIVED (explizit so gewünscht). */
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

type StepInput = { status: Status | string; time: Date; scheduledAt?: Date | null };

function filterMeaningfulSteps(steps: StepInput[]): StepInput[] {
  if (steps.length <= 1) return steps;

  let result: StepInput[] = [];
  const burstMs = STEP_BURST_MINUTES * 60 * 1000;
  const seen = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const curr = steps[i];
    const statusKey = String(curr.status);

    // 1. Consecutive duplicate: skip
    if (result.length > 0 && result[result.length - 1].status === curr.status) continue;

    // 2. Oscillation: status already seen and last was different → cycle, skip
    if (seen.has(statusKey)) {
      const prev = result[result.length - 1];
      if (prev && String(prev.status) !== statusKey) continue;
    }
    seen.add(statusKey);

    // 3. Burst: multiple steps within STEP_BURST_MINUTES – keep last
    let lastInBurst = i;
    for (let j = i + 1; j < steps.length; j++) {
      if (steps[j].time.getTime() - steps[i].time.getTime() <= burstMs) {
        lastInBurst = j;
      } else break;
    }
    const stepToAdd = steps[lastInBurst];
    // After burst: possibly duplicate of last (e.g. A→B→A in 2 min)
    if (result.length > 0 && result[result.length - 1].status === stepToAdd.status) continue;
    result.push(stepToAdd);
    i = lastInBurst;
  }

  // 4. Max steps: when excess, keep 1, 2, "...", n-1, n
  if (result.length > MAX_STEPS) {
    const keepFirst = 2;
    const keepLast = 2;
    const mid = result.length - keepFirst - keepLast;
    result = [
      ...result.slice(0, keepFirst),
      { status: `… (${mid} weitere)`, time: result[keepFirst].time } as StepInput,
      ...result.slice(-keepLast),
    ];
  }

  return result;
}

type GroupEvent = {
  from: Status | string;
  to: Status | string;
  changedAt: Date;
  fromScheduledAt?: Date | null;
};

type GroupMovie = {
  id: number;
  title: string;
  releaseYear: number;
  posterUrl: string | null;
  accentColor: string | null;
  addedAt: Date;
};

type PrevChange = { movieId: number; from: string; to: string; changedAt: Date };

export function buildDigestSummariesWithSteps(
  grouped: Record<number, { movie: GroupMovie; events: GroupEvent[] }>,
  changesByMovie: Map<number, PrevChange[]>
): DigestSummary[] {
  return Object.values(grouped).map((group) => {
    const events = [...group.events].sort(
      (a, b) => a.changedAt.getTime() - b.changedAt.getTime()
    );
    const first = events[0];
    const last = events[events.length - 1];
    const movieChanges = changesByMovie.get(group.movie.id) ?? [];
    const enteredFrom = movieChanges.filter(
      (c) => c.to === first.from && c.changedAt < first.changedAt
    );
    const enteredFromAt =
      enteredFrom.length > 0
        ? enteredFrom[enteredFrom.length - 1].changedAt
        : group.movie.addedAt;

    const rawSteps: StepInput[] = [
      {
        status: first.from,
        time: enteredFromAt,
        scheduledAt: first.from === "VO_SOON" ? first.fromScheduledAt : undefined,
      },
      ...events.map((e, i) => ({
        status: e.to,
        time: e.changedAt,
        scheduledAt:
          e.to === "VO_SOON" ? events[i + 1]?.fromScheduledAt : undefined,
      })),
    ];
    const filteredSteps = filterMeaningfulSteps(rawSteps);

    return {
      movie: {
        id: group.movie.id,
        title: group.movie.title,
        releaseYear: group.movie.releaseYear,
        posterUrl: group.movie.posterUrl,
        accentColor: group.movie.accentColor,
      },
      from: first.from,
      to: last.to,
      finalStatus: last.to,
      fromScheduledAt: first.fromScheduledAt,
      steps: filteredSteps.map((st) => ({
        status: st.status,
        time: format(st.time, "dd.MM.yyyy, HH:mm 'Uhr'", { locale: de }),
        scheduledAt: st.scheduledAt,
      })),
    };
  });
}

function publicUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  const base = (R2_PUBLIC_BASE_URL || APP_URL || "").replace(/\/+$/, "");
  const path = key.replace(/^\/+/, "");
  return base ? `${base}/${path}` : "";
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
  /** Einheitliches Fenster für E-Mail und Discord: letzte 24h (2 × 12h). */
  const digestWindowStart = new Date(
    now.getTime() - 2 * DIGEST_WINDOW_HOURS * 60 * 60 * 1000
  );

  // 1. Undelivered changes aus dem gleichen 24h-Fenster für E-Mails (wie Discord)
  const recentChanges = await prisma.movieStatusChange.findMany({
    where: {
      changedAt: { gte: digestWindowStart, lte: now },
      delivered: false,
    },
    select: {
      id: true,
      movieId: true,
      from: true,
      to: true,
      changedAt: true,
      fromScheduledAt: true,
      movie: {
        select: {
          id: true,
          title: true,
          releaseYear: true,
          posterUrl: true,
          accentColor: true,
          addedAt: true,
        },
      },
    },
    orderBy: { changedAt: "asc" },
  });

  // 2. Gleiche Changes für Discord (gleiches 24h-Fenster)
  // WICHTIG: Neueste zuerst, damit pro Film der letzte Status zählt (z. B. ARCHIVED nach UPLOADED).
  const openChanges = await prisma.movieStatusChange.findMany({
    where: {
      changedAt: { gte: digestWindowStart, lte: now },
      delivered: false,
    },
    select: {
      id: true,
      movieId: true,
      to: true,
      changedAt: true,
      movie: {
        select: { title: true, releaseYear: true },
      },
    },
    orderBy: { changedAt: "desc" },
  });

  // Discord: nur UPLOADED/ARCHIVED (eine Nachricht pro Status)
  // Jeder Film erscheint nur unter seinem neuesten Status (wegen orderBy desc + seenMovies).
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

  // Emails: only when there are recent changes and SMTP is configured
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

    // Predecessor changes for firstTime (when was "from" entered?)
    const movieIds = Object.keys(grouped).map(Number);
    const allChangesForMovies = await prisma.movieStatusChange.findMany({
      where: { movieId: { in: movieIds } },
      select: { movieId: true, from: true, to: true, changedAt: true },
      orderBy: { changedAt: "asc" },
    });
    const changesByMovie = new Map<number, typeof allChangesForMovies>();
    for (const c of allChangesForMovies) {
      if (!changesByMovie.has(c.movieId)) changesByMovie.set(c.movieId, []);
      changesByMovie.get(c.movieId)!.push(c);
    }

    const summaries = buildDigestSummariesWithSteps(grouped, changesByMovie);

    const users = await prisma.user.findMany({
      where: { notificationsEnabled: true },
      select: {
        id: true,
        email: true,
        name: true,
        statusPreferences: { select: { status: true } },
      },
    });

    let sentCount = 0;
    let errorCount = 0;
    for (const user of users) {
      const userStatuses = user.statusPreferences.map((p: { status: Status }) => p.status);
      if (userStatuses.length === 0) continue;
      const relevantSummaries = summaries.filter((s) =>
        userStatuses.includes(s.finalStatus as Status)
      );
      if (relevantSummaries.length === 0) continue;
      try {
        const token = randomBytes(24).toString("base64url");
        const expiresAt = new Date(now.getTime() + VIEW_IN_BROWSER_DAYS * 24 * 60 * 60 * 1000);
        const viewInBrowserUrl = `${APP_URL.replace(/\/+$/, "")}/digest/view/${token}`;

        const html = renderMovieNotificationHtml(
          { name: user.name, email: user.email },
          relevantSummaries,
          APP_URL,
          publicUrl,
          viewInBrowserUrl
        );

        await prisma.digestViewToken.create({
          data: { token, html, userId: user.id, expiresAt },
        });

        await sendEmail({
          to: user.email,
          subject:
            relevantSummaries.length === 1
              ? "CineVault • Es wurde 1 Film aktualisiert."
              : `CineVault • Es wurden ${relevantSummaries.length} Filme aktualisiert.`,
          html,
        });
        sentCount++;
      } catch (err) {
        errorCount++;
        console.error("[digest] Mail-Fehler bei einem Empfänger:", err);
      }
    }
    if (sentCount > 0) {
      console.log(
        `[digest] Erfolgreich an ${sentCount} User gesendet${errorCount > 0 ? `, ${errorCount} Fehler` : ""}`
      );
    } else if (errorCount > 0) {
      console.error(`[digest] Alle ${errorCount} Versandversuche fehlgeschlagen`);
    }
  }

  // Mark all affected changes as delivered
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

/** Delete expired "Open in browser" tokens. Run daily via Cron. */
export async function cleanupExpiredDigestViewTokens(): Promise<number> {
  const result = await prisma.digestViewToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
