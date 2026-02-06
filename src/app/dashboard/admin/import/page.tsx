import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";

export default async function DashboardAdminImportPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/admin/import" });
  if (!hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Film / Serie anlegen
      </h1>

      <div className="rounded-xl border border-ring bg-panel p-8 text-center">
        <p className="text-text/80 mb-4">
          TMDb-basierter Import (Filme, Collections, Serien) wird in einer
          zukünftigen Version integriert.
        </p>
        <p className="text-sm text-text/50">
          Bis dahin können Filme und Serien manuell in der Datenbank angelegt
          oder über eine spätere Import-API ergänzt werden.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg border border-accent bg-accent/20 px-4 py-2 font-semibold text-accent no-underline hover:bg-accent/30"
        >
          Zurück zum Dashboard
        </Link>
      </div>
    </div>
  );
}
