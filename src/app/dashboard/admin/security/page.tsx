import { redirect } from "next/navigation";
import { requireAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { SecurityReportClient } from "./SecurityReportClient";

export default async function AdminSecurityPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/admin/security" });
  if (!hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Security-Report
      </h1>
      <p className="text-text/80 text-sm max-w-2xl">
        Fehlgeschlagene Login- und 2FA-Versuche (Brute-Force-Schutz). Pro IP und pro Account
        werden die letzten Fehlversuche angezeigt; Nutzer mit temporärer Sperre (lockedUntil)
        können hier entsperrt werden.
      </p>
      <SecurityReportClient />
    </div>
  );
}
