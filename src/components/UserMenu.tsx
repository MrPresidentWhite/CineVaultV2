"use client";

import Link from "next/link";
import { useRef, useEffect, useState } from "react";
import { SkeletonImage } from "@/components/ui/SkeletonImage";

export type HeaderUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isMasterAdmin: boolean;
  profileImageUrl: string | null;
  canAdmin: boolean;
  canEditor: boolean;
};

export function UserMenu({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const initial = (user.name || "?").slice(0, 1).toUpperCase();
  const roleClass = user.role?.toLowerCase() ?? "viewer";

  return (
    <div className="relative" ref={containerRef} data-user-menu>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-[#333] bg-[#1b1b1b] px-2.5 py-2 text-left leading-none transition hover:bg-[#222] md:min-h-0 md:py-1.5"
        data-user-trigger
      >
        <span className="relative inline-block h-6 w-6 shrink-0 overflow-hidden rounded-full border border-[#2d2d2d] bg-[#949494] text-center text-[0.85rem] font-bold leading-6 text-white">
          {user.profileImageUrl ? (
            <SkeletonImage
              src={user.profileImageUrl}
              alt={user.name}
              fill
              className="object-cover"
              containerClassName="absolute inset-0"
              sizes="24px"
              unoptimized={user.profileImageUrl.startsWith("http")}
            />
          ) : (
            initial
          )}
        </span>
        <span className="font-semibold text-white hidden sm:inline">{user.name}</span>
        <svg
          className="h-3.5 w-3.5 opacity-80"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      <div
        role="menu"
        tabIndex={-1}
        hidden={!open}
        className="absolute right-0 top-[calc(100%+0.5rem)] z-[2000] max-h-[min(70vh,400px)] min-w-[220px] overflow-y-auto rounded-xl border border-[#2d2d2d] bg-[#171717] p-2 shadow-[0_10px_24px_rgba(0,0,0,.35)]"
        data-user-dropdown
      >
        <div className="mb-2 flex items-center gap-2.5 px-1 py-1">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2d2d2d] bg-[#949494] text-base font-bold text-white">
            {user.profileImageUrl ? (
              <SkeletonImage
                src={user.profileImageUrl}
                alt={user.name}
                fill
                className="object-cover"
                containerClassName="absolute inset-0"
                sizes="36px"
                unoptimized={user.profileImageUrl.startsWith("http")}
              />
            ) : (
              initial
            )}
          </span>
          <div className="min-w-0">
            <div className="font-bold text-white">{user.name}</div>
            <div className="flex flex-wrap gap-1 opacity-75">
              {user.isMasterAdmin && (
                <span className="inline-block rounded-full border border-[#6951a8] bg-[#2b2140] px-1.5 py-0.5 text-[0.75rem] font-bold text-[#e6d3ff]">
                  MASTER
                </span>
              )}
              <span
                className={`inline-block rounded-full border border-white/20 px-1.5 py-0.5 text-[0.75rem] font-bold ${
                  roleClass === "admin"
                    ? "bg-[#301015] text-[#ffa6a6]"
                    : roleClass === "editor"
                      ? "bg-[#102515] text-[#98ffb2]"
                      : "bg-[#111a30] text-[#a8c2ff]"
                }`}
              >
                {user.role}
              </span>
            </div>
          </div>
        </div>

        <div className="my-1.5 h-px bg-[#2d2d2d]" />

        <Link
          href="/dashboard/profile"
          className="flex min-h-[44px] w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-inherit no-underline transition hover:bg-white/[0.06]"
          onClick={() => setOpen(false)}
        >
          Dashboard / Profil
        </Link>
        <Link
          href="/dashboard/stats"
          className="flex min-h-[44px] w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-inherit no-underline transition hover:bg-white/[0.06]"
          onClick={() => setOpen(false)}
        >
          Statistiken
        </Link>
        {user.canAdmin && (
          <Link
            href="/dashboard/admin/users"
            className="flex min-h-[44px] w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-inherit no-underline transition hover:bg-white/[0.06]"
            onClick={() => setOpen(false)}
          >
            Benutzerverwaltung
          </Link>
        )}
        {user.canEditor && (
          <Link
            href="/dashboard/import/movies"
            className="flex min-h-[44px] w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-inherit no-underline transition hover:bg-white/[0.06]"
            onClick={() => setOpen(false)}
          >
            Film anlegen
          </Link>
        )}

        <form method="POST" action="/api/auth/logout" className="mt-0.5">
          <button
            type="submit"
            className="flex min-h-[44px] w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-inherit transition hover:bg-white/[0.06]"
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
