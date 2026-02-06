import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseStoredQuickActions } from "@/lib/quick-actions";
import { getRoutesForUser, canUserAccessHref } from "@/lib/quick-actions-routes";
import { QuickActionsForm } from "../QuickActionsForm";

export default async function ProfileQuickActionsPage() {
  const auth = await requireAuth({
    callbackUrl: "/dashboard/profile/quick-actions",
  });
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { quickActionsJson: true },
  });
  if (!user) return null;

  const userRole = auth.effectiveRole;
  const allStored = parseStoredQuickActions(user.quickActionsJson);
  const initialItems = allStored.filter((item) =>
    canUserAccessHref(item.href, userRole)
  );
  const allowedRoutes = getRoutesForUser(userRole);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Quick Actions
      </h1>
      <p className="text-sm text-text/70">
        Lege die Schnelllinks fest, die unter der Navigation angezeigt werden.
        Du siehst nur Routen, für die du berechtigt bist. Reihenfolge, Titel und
        Emoji kannst du anpassen; die Farbe leitet sich aus dem Emoji ab.
      </p>
      <QuickActionsForm
        initialItems={initialItems}
        allowedRoutes={allowedRoutes}
      />
    </div>
  );
}
