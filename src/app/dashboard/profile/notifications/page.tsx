import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileNotificationsForm } from "../ProfileNotificationsForm";
import type { Status } from "@/generated/prisma/enums";

export default async function ProfileNotificationsPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/profile/notifications" });
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      notificationsEnabled: true,
      statusPreferences: { select: { status: true } },
    },
  });
  if (!user) return null;

  const statusPreferences: Status[] = user.statusPreferences.map((p) => p.status);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        E-Mail-Benachrichtigungen
      </h1>

      <ProfileNotificationsForm
        initialNotificationsEnabled={user.notificationsEnabled}
        initialStatusPreferences={statusPreferences}
      />
    </div>
  );
}
