"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { forced: boolean };

export function DashboardAccountForm({ forced }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const currentPassword = (fd.get("currentPassword") as string) ?? "";
    const newPassword = (fd.get("newPassword") as string) ?? "";
    const confirmPassword = (fd.get("confirmPassword") as string) ?? "";

    setLoading(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: forced ? undefined : currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (data.ok && data.redirectToLogin) {
        window.location.href = "/login?changed=1";
        return;
      }
      setError(data.error ?? "Speichern fehlgeschlagen.");
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-brand-ruby/50 bg-brand-ruby/10 px-4 py-3 text-sm text-brand-ruby">
          {error}
        </div>
      )}
      {!forced && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-text/80">
            Aktuelles Passwort
          </span>
          <input
            type="password"
            name="currentPassword"
            required
            className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            autoComplete="current-password"
          />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text/80">
          Neues Passwort
        </span>
        <input
          type="password"
          name="newPassword"
          required
          minLength={6}
          className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          autoComplete="new-password"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text/80">
          Neues Passwort bestätigen
        </span>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={6}
          className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          autoComplete="new-password"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg border border-accent bg-accent/20 px-4 py-2.5 font-semibold text-accent transition hover:bg-accent/30 disabled:opacity-50"
      >
        {forced ? "Festlegen" : "Ändern"}
      </button>
    </form>
  );
}
