import { redirect } from "next/navigation";
import { isDev, APP_URL, R2_PUBLIC_BASE_URL } from "@/lib/env";
import { renderMovieNotificationHtml } from "@/lib/email-templates";
import { buildDigestSummariesWithSteps } from "@/lib/digest-job";
import { MailPreviewClient } from "./MailPreviewClient";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function publicUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return "";
  const base = (R2_PUBLIC_BASE_URL || APP_URL || "").replace(/\/+$/, "");
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

  const movieIds = Object.keys(grouped).map(Number);
  const allChangesForMovies = await prisma.movieStatusChange.findMany({
    where: { movieId: { in: movieIds } },
    select: { movieId: true, from: true, to: true, changedAt: true },
    orderBy: { changedAt: "asc" },
  });
  const changesByMovie = new Map<
    number,
    { movieId: number; from: string; to: string; changedAt: Date }[]
  >();
  for (const c of allChangesForMovies) {
    if (!changesByMovie.has(c.movieId)) changesByMovie.set(c.movieId, []);
    changesByMovie.get(c.movieId)!.push(c);
  }

  const summaries = buildDigestSummariesWithSteps(grouped, changesByMovie);

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
