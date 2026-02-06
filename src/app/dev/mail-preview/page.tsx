import { redirect } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { isDev, APP_URL, R2_PUBLIC_BASE_URL } from "@/lib/env";
import { renderMovieNotificationHtml } from "@/lib/email-templates";
import type { DigestSummary } from "@/lib/email-templates";
import { MailPreviewClient } from "./MailPreviewClient";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Status } from "@/generated/prisma/enums";

function publicUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return "";
  const base = (R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  const path = key.replace(/^\/+/, "");
  return base ? `${base}/${path}` : path || "";
}

const PREVIEW_DAYS = 30;

export default async function DevMailPreviewPage() {
  if (!isDev) {
    redirect("/");
  }

  const auth = await requireAuth({ callbackUrl: "/dev/mail-preview" });
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { name: true, email: true },
  });
  if (!user?.email) redirect("/");

  const since = new Date();
  since.setDate(since.getDate() - PREVIEW_DAYS);

  const changes = await prisma.movieStatusChange.findMany({
    where: { changedAt: { gte: since } },
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

  const grouped = changes.reduce<
    Record<
      number,
      { movie: (typeof changes)[0]["movie"]; events: typeof changes }
    >
  >((acc, change) => {
    if (!acc[change.movieId]) {
      acc[change.movieId] = { movie: change.movie, events: [] };
    }
    acc[change.movieId].events.push(change);
    return acc;
  }, {});

  const summaries: DigestSummary[] = Object.values(grouped).map((group) => {
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
      finalStatus: last.to as Status,
    };
  });

  const html = renderMovieNotificationHtml(
    { name: user.name, email: user.email },
    summaries,
    APP_URL,
    publicUrl
  );

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        E-Mail-Template Vorschau
      </h1>
      {summaries.length === 0 ? (
        <p className="text-sm text-text/70">
          Keine Statusänderungen in den letzten {PREVIEW_DAYS} Tagen in der DB.
          Template wird mit leerer Liste gerendert.
        </p>
      ) : null}
      <MailPreviewClient html={html} />
    </div>
  );
}
