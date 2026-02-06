import Link from "next/link";
import { hasEffectiveRole, requireAuth } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { DashboardSidebarNav } from "@/components/dashboard/DashboardSidebarNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAuth({ callbackUrl: "/dashboard" });
  const canAdmin = hasEffectiveRole(auth, RoleEnum.ADMIN);
  const canEditor = hasEffectiveRole(auth, RoleEnum.EDITOR);

  const nav = [
    {
      type: "link" as const,
      href: "/dashboard",
      label: "Übersicht",
      icon: "📊",
    },
    {
      type: "group" as const,
      label: "Profil",
      icon: "👤",
      basePath: "/dashboard/profile",
      children: [
        { href: "/dashboard/profile", label: "Übersicht" },
        { href: "/dashboard/profile/quick-actions", label: "Quick Actions" },
        { href: "/dashboard/profile/devices", label: "Angemeldete Geräte" },
        { href: "/dashboard/profile/notifications", label: "E-Mail-Benachrichtigungen" },
      ],
    },
    {
      type: "group" as const,
      label: "Sicherheit",
      icon: "🔐",
      basePath: "/dashboard/account",
      children: [{ href: "/dashboard/account", label: "Passwort ändern" }],
    },
    {
      type: "link" as const,
      href: "/dashboard/stats",
      label: "Statistiken",
      icon: "📈",
    },
    ...(canEditor
      ? [
          {
            type: "group" as const,
            label: "Import",
            icon: "📥",
            basePath: "/dashboard/import",
            children: [
              { href: "/dashboard/import/movies", label: "Filme" },
              { href: "/dashboard/import/series", label: "Serien" },
            ],
          },
        ]
      : []),
  ];
  const adminNav = [
    ...(canAdmin
      ? [
          {
            href: "/dashboard/admin/users",
            label: "Benutzerverwaltung",
            icon: "👥",
          },
        ]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-[5] flex bg-bg text-text"
      style={{ top: "var(--header-height)" }}
    >
      {/* Sidebar – fest stehend, unterhalb der Navbar; einheitlicher Abstand um „Dashboard“ */}
      <aside className="flex h-full w-56 shrink-0 flex-col border-r border-ring bg-panel min-h-0">
        <div className="shrink-0 px-4 pt-3 pb-1.5 border-b border-ring">
          <Link href="/dashboard" className="font-semibold text-lg text-text no-underline hover:text-accent transition">
            Dashboard
          </Link>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pt-1.5 pb-3 space-y-0.5" aria-label="Dashboard-Navigation">
          <DashboardSidebarNav nav={nav} adminNav={adminNav} />
        </nav>
        <div className="mt-auto shrink-0 border-t border-ring p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text/70 no-underline transition hover:bg-white/5 hover:text-text"
          >
            ← Zur Startseite
          </Link>
        </div>
      </aside>

      {/* Main content – nur hier scrollen */}
      <main className="min-h-0 min-w-0 flex-1 overflow-auto p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
