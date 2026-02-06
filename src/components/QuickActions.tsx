"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { QuickActionItem } from "@/lib/quick-actions";

type QuickActionsProps = {
  items: QuickActionItem[];
};

export function QuickActions({ items }: QuickActionsProps) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname?.startsWith("/dashboard")) return null;
  if (items.length === 0) return null;

  return (
    <section className="section-qa border-b border-ring px-3 py-2.5 md:px-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
        {items.map((q, i) => (
          <Link
            key={`${q.href}-${q.title}-${i}`}
            href={q.href}
            className="group flex items-center gap-2.5 rounded-[10px] border border-ring bg-gradient-to-b from-white/[0.015] to-black/20 px-3 py-2.5 text-left transition-[transform,box-shadow,border-color,background] duration-[100ms] hover:-translate-y-px hover:border-accent/75 hover:from-white/[0.04] hover:to-black/20 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            style={{ "--tw-accent": q.accent } as React.CSSProperties}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl shadow-[inset_0_0_0_1px]"
              style={{
                background: `color-mix(in oklab, ${q.accent} 16%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${q.accent} 45%, #000 55%)`,
              }}
            >
              {q.icon}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[0.98rem] font-bold">
                {q.title}
              </strong>
              <span className="block truncate text-[0.86rem] opacity-85">
                {q.desc}
              </span>
            </span>
            <span className="ml-auto text-xl opacity-70 transition translate-x-0 group-hover:translate-x-0.5 group-hover:opacity-95" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
