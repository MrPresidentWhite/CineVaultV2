"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { QuickActions } from "@/components/QuickActions";
import type { HeaderUser } from "@/components/UserMenu";
import type { QuickActionItem } from "@/lib/quick-actions";

type AppShellProps = {
  user: HeaderUser | null;
  quickActionsItems: QuickActionItem[];
  children: React.ReactNode;
};

/**
 * Zeigt Header + QuickActions + Main nur außerhalb von /api-docs.
 * Auf /api-docs wird nur der Inhalt in einem isolierten Container gerendert,
 * damit Swagger UI sein eigenes Design behält.
 */
export function AppShell({
  user,
  quickActionsItems,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const isApiDocs = pathname?.startsWith("/api-docs");

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

  if (isApiDocs) {
    return <div className="api-docs-standalone">{children}</div>;
  }

  return (
    <div className="min-h-dvh">
      <Header user={user} />
      <div className="hidden md:block">
        <QuickActions items={quickActionsItems} />
      </div>
      <main className="main px-4 py-4 md:px-7 md:py-7">{children}</main>
    </div>
  );
}
