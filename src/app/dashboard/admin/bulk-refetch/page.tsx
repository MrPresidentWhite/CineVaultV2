import { redirect } from "next/navigation";
import { requireAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { BulkRefetchClient } from "./BulkRefetchClient";

export default async function AdminBulkRefetchPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/admin/bulk-refetch" });
  if (!hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Bulk Refetch: Meta & Bilder
      </h1>
      <p className="text-text/80 text-sm max-w-2xl">
        Lädt für alle Filme, Serien oder Collections Metadaten (Titel, Overview, FSK etc.) und
        Bilder (Poster, Backdrop) von TMDb nach. Pro Typ werden Batches verarbeitet; Fortschritt
        und Log werden unten angezeigt. Bei Filmen wird nur 1 TMDb-API-Call pro Film genutzt
        (release_dates in getMovie).
      </p>
      <BulkRefetchClient />
    </div>
  );
}
