import { requireAuth } from "@/lib/auth";
import { getSessionIdFromCookie } from "@/lib/session";
import { getDevicesForUser } from "@/lib/devices-data";
import { DevicesList } from "./DevicesList";

export default async function ProfileDevicesPage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/profile/devices" });
  const currentSid = await getSessionIdFromCookie();
  const devices = await getDevicesForUser(auth.user.id, currentSid);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">
        Angemeldete Geräte
      </h1>

      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text mb-4">
          Geräte & Sitzungen
        </h2>
        <p className="text-sm text-text/70 mb-6">
          Hier siehst du die Geräte und Sitzungen, mit denen du angemeldet bist. Du kannst einzelne Sitzungen oder alle anderen abmelden.
        </p>

        {devices.length === 0 ? (
          <p className="text-sm text-text/50">Keine aktiven Sitzungen.</p>
        ) : (
          <DevicesList devices={devices} />
        )}
      </section>
    </div>
  );
}
