import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { statusLabels } from "@/lib/enum-mapper";
import { getDashboardOverviewUi } from "@/lib/dashboard-overview";

export default async function DashboardPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard" });
  const ui = await getDashboardOverviewUi();

  const fmt = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isEditor = hasEffectiveRole(auth, RoleEnum.EDITOR);
  const isAdmin = hasEffectiveRole(auth, RoleEnum.ADMIN);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">Übersicht</h1>

      {/* Quick KPIs */}
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Schnellüberblick</h2>
        <p className="mt-1 text-sm text-text/60">
          Aktivität, offener Bestand und wichtige Shortcuts – ohne Umwege.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/movies"
            className="rounded-xl border border-ring bg-bg/30 p-5 text-left no-underline transition hover:border-accent/50"
          >
            <p className="text-sm font-medium text-text/60">Filme</p>
            <p className="mt-1 text-2xl font-bold text-text">
              {ui.counts.movies}
            </p>
          </Link>
          <Link
            href="/collections"
            className="rounded-xl border border-ring bg-bg/30 p-5 text-left no-underline transition hover:border-accent/50"
          >
            <p className="text-sm font-medium text-text/60">Collections</p>
            <p className="mt-1 text-2xl font-bold text-text">
              {ui.counts.collections}
            </p>
          </Link>
          <Link
            href="/series"
            className="rounded-xl border border-ring bg-bg/30 p-5 text-left no-underline transition hover:border-accent/50"
          >
            <p className="text-sm font-medium text-text/60">Serien</p>
            <p className="mt-1 text-2xl font-bold text-text">
              {ui.counts.series}
            </p>
          </Link>
          <Link
            href="/dashboard/stats"
            className="rounded-xl border border-accent/30 bg-accent/10 p-5 text-left no-underline transition hover:bg-accent/15"
          >
            <p className="text-sm font-medium text-accent/90">Statistiken</p>
            <p className="mt-1 text-2xl font-bold text-accent">Anzeigen</p>
          </Link>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">
              Vollständig verarbeitet
            </p>
            <p className="mt-1 text-xl font-bold text-text">
              {ui.processed.fullyProcessed}{" "}
              <span className="text-sm font-normal text-text/60">
                ({(ui.processed.pct * 100).toFixed(1)} %)
              </span>
            </p>
            <p className="mt-2 text-xs text-text/50">
              Status „Hochgeladen“ oder „Archiviert“.
            </p>
          </div>
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Offen / To‑Do</p>
            <p className="mt-1 text-xl font-bold text-text">
              {ui.todo.reduce((a, b) => a + b.count, 0)}
            </p>
            <p className="mt-2 text-xs text-text/50">
              Verarbeitung, Versand, VÖ‑Warteliste, Watchlist/Wunschliste.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity */}
        <section className="rounded-xl border border-ring bg-panel p-6">
          <h2 className="text-lg font-semibold text-text">
            Aktivität (letzte 24h)
          </h2>
          <p className="mt-1 text-sm text-text/60">
            Die letzten Statusänderungen – ideal, um schnell zu sehen, was
            passiert ist.
          </p>

          {ui.recentChanges.length === 0 ? (
            <p className="mt-4 text-sm text-text/70">
              Keine Statusänderungen in den letzten 24 Stunden.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {ui.recentChanges.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-ring bg-bg/30 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/movies/${c.movieId}`}
                        className="block truncate text-sm font-medium text-text hover:text-accent"
                      >
                        {c.title} ({c.year})
                      </Link>
                      <p className="mt-1 text-xs text-text/60">
                        {statusLabels[c.from]} →{" "}
                        <span className="text-text/80 font-medium">
                          {statusLabels[c.to]}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-xs text-text/50">
                      {fmt.format(c.changedAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* To-do by status */}
        <section className="rounded-xl border border-ring bg-panel p-6">
          <h2 className="text-lg font-semibold text-text">Offen / To‑Do</h2>
          <p className="mt-1 text-sm text-text/60">
            Direkt in die passende Filteransicht springen.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {ui.todo.map((t) => (
              <Link
                key={t.status}
                href={`/movies?status=${encodeURIComponent(t.status)}`}
                className="rounded-lg border border-ring bg-bg/30 px-4 py-3 no-underline transition hover:border-accent/40"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-text/80">
                    {statusLabels[t.status]}
                  </span>
                  <span className="text-sm font-bold text-text">{t.count}</span>
                </div>
                <p className="mt-1 text-xs text-text/50">
                  Filter: Status = {t.status}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/movies"
              className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 no-underline"
            >
              Alle Filme öffnen
            </Link>
            <Link
              href="/dashboard/stats"
              className="rounded-lg border border-ring bg-bg/30 px-4 py-2 text-sm font-medium text-text/80 transition hover:border-accent/40 no-underline"
            >
              Zu den Statistiken
            </Link>
          </div>
        </section>
      </div>

      {/* Quick actions */}
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Schnellaktionen</h2>
        <p className="mt-1 text-sm text-text/60">
          Häufige Aktionen – abhängig von deiner Rolle.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/dashboard/profile"
            className="rounded-lg border border-ring bg-bg/30 px-4 py-2 text-sm font-medium text-text/80 transition hover:border-accent/40 no-underline"
          >
            Profil öffnen
          </Link>
          <Link
            href="/dashboard/profile/notifications"
            className="rounded-lg border border-ring bg-bg/30 px-4 py-2 text-sm font-medium text-text/80 transition hover:border-accent/40 no-underline"
          >
            Benachrichtigungen
          </Link>
          {isEditor ? (
            <Link
              href="/dashboard/admin/import"
              className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 no-underline"
            >
              Film / Serie anlegen
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              href="/dashboard/admin/users"
              className="rounded-lg border border-ring bg-bg/30 px-4 py-2 text-sm font-medium text-text/80 transition hover:border-accent/40 no-underline"
            >
              Benutzerverwaltung
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
