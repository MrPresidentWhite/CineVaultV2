"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { statusLabels } from "@/lib/enum-mapper";
import type { Status } from "@/generated/prisma/enums";
import { Status as StatusEnum } from "@/generated/prisma/enums";

const ALL_STATUSES: Status[] = Object.values(StatusEnum);

type Props = {
  initialNotificationsEnabled: boolean;
  initialStatusPreferences: Status[];
};

export function ProfileNotificationsForm({
  initialNotificationsEnabled,
  initialStatusPreferences,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialNotificationsEnabled);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<Status>>(
    new Set(initialStatusPreferences)
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const toggleStatus = (s: Status) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const initialPrefsSet = new Set(initialStatusPreferences);
  const hasChanges =
    enabled !== initialNotificationsEnabled ||
    selectedStatuses.size !== initialPrefsSet.size ||
    [...selectedStatuses].some((s) => !initialPrefsSet.has(s)) ||
    [...initialPrefsSet].some((s) => !selectedStatuses.has(s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/profile/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationsEnabled: enabled,
          statusPreferences: enabled ? [...selectedStatuses] : [],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("ok");
        router.refresh();
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        setError(data.error ?? "Speichern fehlgeschlagen");
      }
    } catch {
      setStatus("error");
      setError("Netzwerkfehler");
    }
  }

  return (
    <section className="rounded-xl border border-ring bg-panel p-6">
      <h2 className="text-lg font-semibold text-text mb-4">
        E-Mail-Benachrichtigungen
      </h2>
      <p className="text-sm text-text/70 mb-4">
        Täglich um 10 und 21 Uhr eine Übersicht über neue Film-Status (wenn aktiviert).
      </p>

      <form onSubmit={save} className="space-y-6">
        <div className="flex items-center gap-3">
          <input
            id="notifications-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={status === "loading"}
            className="h-4 w-4 rounded border-ring bg-bg text-accent focus:ring-accent"
          />
          <label
            htmlFor="notifications-enabled"
            className="text-sm font-medium text-text/90 cursor-pointer"
          >
            E-Mail-Benachrichtigungen aktivieren
          </label>
        </div>

        {enabled && (
          <div>
            <h3 className="text-sm font-medium text-text/80 mb-2">
              Benachrichtige mich, wenn ein Film diesen Status erreicht
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2 text-sm">
              {ALL_STATUSES.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <input
                    id={`status-${s}`}
                    type="checkbox"
                    checked={selectedStatuses.has(s)}
                    onChange={() => toggleStatus(s)}
                    disabled={status === "loading"}
                    className="h-4 w-4 rounded border-ring bg-bg text-accent focus:ring-accent"
                  />
                  <label
                    htmlFor={`status-${s}`}
                    className="text-text/80 cursor-pointer"
                  >
                    {statusLabels[s] ?? s}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="text-sm text-brand-ruby">{error}</p>
        )}

        <button
          type="submit"
          disabled={status === "loading" || !hasChanges}
          className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading"
            ? "Speichern…"
            : status === "ok"
              ? "Gespeichert"
              : "Einstellungen speichern"}
        </button>
      </form>
    </section>
  );
}
