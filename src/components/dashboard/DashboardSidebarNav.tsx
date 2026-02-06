"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string; icon: string };
export type NavGroup = {
  label: string;
  icon: string;
  children: { href: string; label: string }[];
};

type NavItem =
  | { type: "link"; href: string; label: string; icon: string }
  | { type: "group"; label: string; icon: string; basePath: string; children: { href: string; label: string }[] };

type Props = {
  nav: NavItem[];
  adminNav: NavLink[];
};

export function DashboardSidebarNav({ nav, adminNav }: Props) {
  const pathname = usePathname();

  return (
    <>
      {nav.map((item) => {
        if (item.type === "link") {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm no-underline transition hover:bg-white/5 hover:text-text ${
                active ? "bg-white/10 text-text font-medium" : "text-text/90"
              }`}
            >
              <span className="text-base opacity-80" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        }
        // group = Accordion (Klick auf Label geht zum ersten Unterpunkt)
        const isExpanded = pathname?.startsWith(item.basePath) ?? false;
        const overviewHref = item.children[0]?.href ?? item.basePath;
        return (
          <div key={item.label} className="space-y-0.5">
            <Link
              href={overviewHref}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm no-underline transition hover:bg-white/5 hover:text-text font-medium ${
                pathname === overviewHref ? "bg-white/10 text-text" : "text-text/90"
              }`}
              aria-expanded={isExpanded}
            >
              <span className="text-base opacity-80" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
            {isExpanded && (
              <ul className="ml-4 space-y-0.5 border-l border-ring pl-3" role="list">
                {item.children.map((child) => {
                  const childActive = pathname === child.href;
                  return (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className={`block rounded-lg px-2 py-2 text-sm no-underline transition hover:bg-white/5 hover:text-text ${
                          childActive ? "text-accent font-medium" : "text-text/80"
                        }`}
                      >
                        {child.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      {adminNav.length > 0 && (
        <>
          <div className="my-3 h-px bg-ring" role="separator" />
          <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-text/50">
            Admin
          </p>
          {adminNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm no-underline transition hover:bg-white/5 hover:text-text ${
                  active ? "bg-white/10 text-text font-medium" : "text-text/90"
                }`}
              >
                <span className="text-base opacity-80" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </>
      )}
    </>
  );
}
