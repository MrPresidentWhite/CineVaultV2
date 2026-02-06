"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UserMenu, type HeaderUser } from "./UserMenu";
import { SearchBar } from "./SearchBar";

type HeaderProps = {
  user: HeaderUser | null;
};

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <header className="app-header sticky top-0 z-[1000] flex items-center gap-6 border-b border-ring bg-bg/80 px-7 py-5 backdrop-blur-[6px]">
      {/* Brand */}
      <Link
        href="/"
        className="flex items-center gap-3.5"
        aria-label="Startseite"
      >
        <Image
          src="/assets/logo-big.svg"
          alt="CineVault"
          width={140}
          height={48}
          className="h-8 w-auto max-w-[70%]"
        />
      </Link>

      {/* Spacer: schiebt Suche + User nach rechts (wie im alten Layout) */}
      <div className="flex-1" aria-hidden />

      {/* Suche (Live-Suggest), nur wenn nicht Login */}
      {!isLoginPage && <SearchBar />}

      {/* User-Menü oder Login-Link */}
      {!isLoginPage && (
        <>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-[10px] border border-[#333] bg-[#1b1b1b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#222]"
            >
              Login
            </Link>
          )}
        </>
      )}
    </header>
  );
}
