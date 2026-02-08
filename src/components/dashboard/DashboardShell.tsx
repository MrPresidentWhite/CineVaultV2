"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { DashboardSidebarNav, type NavLink } from "./DashboardSidebarNav";

type NavItem =
  | { type: "link"; href: string; label: string; icon: string }
  | { type: "group"; label: string; icon: string; basePath: string; children: { href: string; label: string }[] };

type Props = {
  nav: NavItem[];
  adminNav: NavLink[];
  children: React.ReactNode;
};

export function DashboardShell({ nav, adminNav, children }: Props) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setSidebarOpen(false));
  }, [pathname]);

  return (
    <div
      className="fixed inset-0 z-[5] flex bg-bg text-text"
      style={{ top: "var(--header-height)" }}
    >
      {/* Backdrop (nur Mobile, wenn Drawer offen) */}
      <button
        type="button"
        aria-label="Menü schließen"
        onClick={() => setSidebarOpen(false)}
        className="fixed inset-0 z-[6] bg-black/60 backdrop-blur-sm md:hidden"
        style={{ top: "var(--header-height)", opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? "auto" : "none" }}
      />

      {/* Sidebar: Desktop im Flex-Flow, Mobile als Drawer (fixed, slide-in) */}
      <aside
        className={`fixed left-0 top-[var(--header-height)] bottom-0 z-10 flex h-full w-56 shrink-0 flex-col border-r border-ring bg-panel min-h-0 transition-transform duration-200 ease-out md:relative md:left-0 md:top-0 md:bottom-0 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="shrink-0 flex items-center justify-between border-b border-ring px-4 py-3 md:block md:border-b md:px-4 md:pt-3 md:pb-1.5">
            <Link
              href="/dashboard"
              className="font-semibold text-lg text-text no-underline hover:text-accent transition"
              onClick={() => setSidebarOpen(false)}
            >
              Dashboard
            </Link>
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-text/80 hover:bg-white/10 hover:text-text md:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pt-1.5 pb-3 space-y-0.5" aria-label="Dashboard-Navigation">
            <DashboardSidebarNav nav={nav} adminNav={adminNav} />
          </nav>
          <div className="mt-auto shrink-0 border-t border-ring p-3">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text/70 no-underline transition hover:bg-white/5 hover:text-text"
              onClick={() => setSidebarOpen(false)}
            >
              ← Zur Startseite
            </Link>
          </div>
        </div>
      </aside>

      {/* Main + Mobile Menu-Button */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Hamburger nur auf Mobile */}
        <div className="sticky top-0 z-[4] flex shrink-0 items-center border-b border-ring bg-bg/95 px-4 py-3 backdrop-blur-sm md:hidden">
          <button
            type="button"
            aria-label="Menü öffnen"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-text hover:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            Menü
          </button>
        </div>
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
