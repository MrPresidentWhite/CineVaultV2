import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { ApiKeyPageClient } from "./ApiKeyPageClient";

export default async function DashboardApiKeyPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/api-key" });
  if (!hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text tracking-tight">
          API Key
        </h1>
        <Link
          href="/api-docs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline"
        >
          API-Dokumentation öffnen →
        </Link>
      </div>

      <ApiKeyPageClient />
    </div>
  );
}
