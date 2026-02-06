import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DashboardAccountForm } from "./DashboardAccountForm";

export default async function DashboardAccountPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/account" });
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { mustChangePassword: true },
  });
  const forced = user?.mustChangePassword ?? false;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Sicherheit
      </h1>

      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text mb-4">
          {forced ? "Passwort festlegen" : "Passwort ändern"}
        </h2>
        <p className="text-sm text-text/70 mb-4">
          {forced
            ? "Du musst ein neues Passwort festlegen, bevor du fortfahren kannst."
            : "Hier kannst du dein Passwort ändern. Danach wirst du erneut angemeldet."}
        </p>
        <div className="max-w-md">
          <DashboardAccountForm forced={forced} />
        </div>
      </section>
    </div>
  );
}
