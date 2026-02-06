import { redirect } from "next/navigation";
import { requireAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { toPublicUrl } from "@/lib/storage";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function DashboardAdminUsersPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/admin/users" });
  if (!hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: [{ isMasterAdmin: "desc" }, { role: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      profileImageKey: true,
      profileBannerKey: true,
      isMasterAdmin: true,
      mustChangePassword: true,
      locked: true,
      createdAt: true,
    },
  });

  const usersWithAvatar = users.map((u) => ({
    ...u,
    avatarUrl: toPublicUrl(u.profileImageKey) ?? null,
    bannerUrl: toPublicUrl(u.profileBannerKey) ?? null,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Benutzerverwaltung
      </h1>
      <AdminUsersClient users={usersWithAvatar} currentUserId={auth.user.id} />
    </div>
  );
}
