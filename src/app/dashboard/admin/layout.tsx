import { redirect } from "next/navigation";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

/**
 * Admin-Bereich: Mindestens EDITOR. Einzelne Seiten prüfen ADMIN wo nötig.
 */
export default async function DashboardAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuth();
  if (!auth) redirect("/login?callbackUrl=/dashboard");
  if (!hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
