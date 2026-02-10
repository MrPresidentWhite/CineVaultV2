import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { Header } from "@/components/Header";
import { QuickActions } from "@/components/QuickActions";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { toPublicUrl } from "@/lib/storage";
import { getQuickActionsForUser } from "@/lib/quick-actions";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CineVault",
  description: "Deine Film- und Seriensammlung",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await getAuth();
  const userPayload =
    auth != null
      ? {
          id: auth.user.id,
          name: auth.user.name,
          email: auth.user.email,
          role: auth.user.role,
          isMasterAdmin: auth.user.isMasterAdmin ?? false,
          profileImageUrl: toPublicUrl(auth.user.profileImageKey) ?? null,
          canAdmin: hasEffectiveRole(auth, RoleEnum.ADMIN),
          canEditor: hasEffectiveRole(auth, RoleEnum.EDITOR),
        }
      : null;

  const quickActionsItems =
    auth != null
      ? getQuickActionsForUser(
          auth.user.quickActionsJson ?? null,
          auth.effectiveRole
        )
      : getQuickActionsForUser(null, RoleEnum.VIEWER);

  return (
    <html lang="de">
      <body
        className={`${inter.variable} font-sans bg-bg text-text antialiased`}
      >
        <div className="flex h-dvh flex-col">
          <Header user={userPayload} />
          <div className="hidden md:block">
            <QuickActions items={quickActionsItems} />
          </div>
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
