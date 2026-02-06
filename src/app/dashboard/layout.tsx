import { hasEffectiveRole, requireAuth } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

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
    <DashboardShell nav={nav} adminNav={adminNav}>
      {children}
    </DashboardShell>
  );
}
