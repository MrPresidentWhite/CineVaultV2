import { requireAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { ImportSeriesClient } from "./ImportSeriesClient";

export default async function ImportSeriesPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/import/series" });
  if (!hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return null;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Import – Serien
      </h1>
      <ImportSeriesClient />
    </div>
  );
}

