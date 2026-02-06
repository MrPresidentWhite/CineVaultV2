import { redirect } from "next/navigation";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

/**
 * Import-Bereich: Mindestens EDITOR (Filme & Serien importieren).
 */
export default async function DashboardImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuth();
  if (!auth) redirect("/login?callbackUrl=/dashboard/import/movies");
  if (!hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}

