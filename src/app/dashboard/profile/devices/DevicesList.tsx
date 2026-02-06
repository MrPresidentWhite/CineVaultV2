"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DeviceSession } from "@/lib/devices-data";
import { DeviceIcon } from "@/components/dashboard/DeviceIcon";

type Props = {
  devices: DeviceSession[];
};

function formatDate(d: Date): string {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Gerade eben";
  if (diffMins < 60) return `Vor ${diffMins} Min.`;
  if (diffHours < 24) return `Vor ${diffHours} Std.`;
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function DevicesList({ devices }: Props) {
  const router = useRouter();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = devices.filter((d) => !d.isCurrent);

  async function revokeSession(id: string) {
    setError(null);
    setRevokingId(id);
    try {
      const res = await fetch(`/api/profile/devices/${id}/revoke`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        if (data.redirectToLogin) {
          document.cookie = "cv.sid=; Max-Age=0; Path=/";
          window.location.href = "/login";
          return;
        }
        router.refresh();
      } else {
        setError(data.error ?? "Abmelden fehlgeschlagen");
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeAllOthers() {
    if (others.length === 0) return;
    setError(null);
    setRevokingAll(true);
    try {
      const res = await fetch("/api/profile/devices/revoke-all-others", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        router.refresh();
      } else {
        setError(data.error ?? "Abmelden fehlgeschlagen");
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setRevokingAll(false);
    }
  }

  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg border border-brand-ruby/50 bg-brand-ruby/10 px-4 py-3 text-sm text-brand-ruby">
          {error}
        </p>
      )}

      <ul className="space-y-3" role="list">
        {devices.map((device) => (
          <li key={device.id}>
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-ring bg-bg/50 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-ring bg-panel text-text/70">
                <DeviceIcon type={device.deviceType} className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text">
                  {device.browser}
                  {device.os !== "Unbekanntes OS" ? ` · ${device.os}` : ""}
                </p>
                <p className="text-sm text-text/60">
                  {device.ip} · Zuletzt aktiv: {formatDate(device.lastSeenAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {device.isCurrent ? (
                  <span className="inline-flex rounded-full border border-green-500/50 bg-green-500/20 px-2.5 py-1 text-xs font-semibold text-green-400">
                    Dieses Gerät
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => revokeSession(device.id)}
                    disabled={revokingId === device.id}
                    className="rounded-lg border border-ring bg-panel px-3 py-1.5 text-sm font-medium text-text/80 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    {revokingId === device.id ? "Wird abgemeldet…" : "Abmelden"}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={revokeAllOthers}
            disabled={revokingAll}
            className="rounded-lg border border-brand-ruby/50 bg-brand-ruby/10 px-4 py-2 text-sm font-medium text-brand-ruby transition hover:bg-brand-ruby/20 disabled:opacity-50"
          >
            {revokingAll ? "Wird abgemeldet…" : "Alle anderen Geräte abmelden"}
          </button>
          <span className="text-sm text-text/50">
            {others.length} {others.length === 1 ? "Gerät" : "Geräte"} werden abgemeldet
          </span>
        </div>
      )}
    </>
  );
}
