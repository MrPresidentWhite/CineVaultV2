"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type AppShellProps = {
  children: React.ReactNode;
};

/**
 * Content-Shell:
 * - Spezialfall /api-docs: Standalone-Container für Swagger UI
 * - globaler Cleanup für hängengebliebene Modal-Klassen
 * Header + QuickActions werden im RootLayout gerendert.
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isApiDocs = pathname?.startsWith("/api-docs");
  const isDashboard = pathname?.startsWith("/dashboard");

  useEffect(() => {
    if (!isApiDocs) return;
    document.documentElement.style.colorScheme = "light";
    document.body.style.background = "#fafafa";
    document.body.style.color = "#3b4151";
    return () => {
      document.documentElement.style.colorScheme = "";
      document.body.style.background = "";
      document.body.style.color = "";
    };
  }, [isApiDocs]);

  // Fallback: bei jedem Routenwechsel sicherstellen, dass evtl. hängen gebliebene
  // Modal-Klassen (modal-open) entfernt werden, damit das globale Scrolling
  // außerhalb von Modals/Dashboard nicht blockiert ist.
  useEffect(() => {
    document.documentElement.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
  }, [pathname]);

  if (isApiDocs) {
    return <div className="api-docs-standalone">{children}</div>;
  }

  // Dashboard-Seiten bekommen ihr eigenes Layout/Scrolling via DashboardShell
  if (isDashboard) {
    return <>{children}</>;
  }

  // Öffentliche Seiten: eigener Scrollport innerhalb des festen Viewports
  return (
    <main className="main flex-1 overflow-y-auto px-4 py-4 md:px-7 md:py-7">
      {children}
    </main>
  );
}
