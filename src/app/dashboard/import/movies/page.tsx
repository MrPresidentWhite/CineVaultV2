import { requireAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { statusLabels, priorityLabels, mediaTypeLabels } from "@/lib/enum-mapper";
import type { Status, Priority, MediaType } from "@/generated/prisma/enums";
import { ImportMoviesClient } from "./ImportMoviesClient";

export default async function ImportMoviesPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/import/movies" });
  if (!hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    // zusätzliche Absicherung, Layout prüft bereits
    return null;
  }

  const users = await prisma.user.findMany({
    where: { role: { in: [RoleEnum.EDITOR, RoleEnum.ADMIN] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  const enums = {
    statusLabels: statusLabels as Record<Status, string>,
    priorityLabels: priorityLabels as Record<Priority, string>,
    mediaTypeLabels: mediaTypeLabels as Record<MediaType, string>,
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Import – Filme
      </h1>
      <ImportMoviesClient
        enums={enums}
        users={users}
        currentUserId={auth.user.id}
      />
    </div>
  );
}

