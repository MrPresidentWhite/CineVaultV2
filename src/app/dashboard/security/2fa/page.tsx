import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TwoFactorClient } from "./TwoFactorClient";

export default async function TwoFactorPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/security/2fa" });
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { totpEnabledAt: true },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">2FA</h1>
      <TwoFactorClient initialEnabled={!!user?.totpEnabledAt} />
    </div>
  );
}
