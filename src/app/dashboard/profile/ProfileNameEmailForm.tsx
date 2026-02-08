"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken, csrfHeaders, setCsrfToken } from "@/lib/csrf-client";

type Props = {
  initialName: string;
  initialEmail: string;
};

export function ProfileNameEmailForm({ initialName, initialEmail }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [nameStatus, setNameStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setNameStatus("loading");
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/profile/update-name", {
        method: "POST",
        headers: { ...csrfHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      if (data.ok) {
        setNameStatus("ok");
        router.refresh();
        setTimeout(() => setNameStatus("idle"), 2000);
      } else {
        setNameStatus("error");
        setNameError(data.error ?? "Speichern fehlgeschlagen");
      }
    } catch {
      setNameStatus("error");
      setNameError("Netzwerkfehler");
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailStatus("loading");
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/profile/update-email", {
        method: "POST",
        headers: { ...csrfHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      if (data.ok) {
        setEmailStatus("ok");
        router.refresh();
        setTimeout(() => setEmailStatus("idle"), 2000);
      } else {
        setEmailStatus("error");
        setEmailError(data.error ?? "Speichern fehlgeschlagen");
      }
    } catch {
      setEmailStatus("error");
      setEmailError("Netzwerkfehler");
    }
  }

  return (
    <section className="rounded-xl border border-ring bg-panel p-6">
      <h2 className="text-lg font-semibold text-text mb-4">
        Benutzername & E-Mail
      </h2>
      <p className="text-sm text-text/70 mb-4">
        Name und E-Mail können hier geändert werden.
      </p>
      <div className="grid gap-6 sm:grid-cols-2 max-w-2xl">
        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-text/80 mb-1">
            Benutzername
          </label>
          <form onSubmit={saveName} className="space-y-2">
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Name"
              minLength={2}
              disabled={nameStatus === "loading"}
            />
            {nameError && (
              <p className="text-sm text-brand-ruby">{nameError}</p>
            )}
            <button
              type="submit"
              disabled={nameStatus === "loading" || name.trim() === initialName}
              className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {nameStatus === "loading"
                ? "Speichern…"
                : nameStatus === "ok"
                  ? "Gespeichert"
                  : "Name speichern"}
            </button>
          </form>
        </div>
        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium text-text/80 mb-1">
            E-Mail
          </label>
          <form onSubmit={saveEmail} className="space-y-2">
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="E-Mail"
              disabled={emailStatus === "loading"}
            />
            {emailError && (
              <p className="text-sm text-brand-ruby">{emailError}</p>
            )}
            <button
              type="submit"
              disabled={emailStatus === "loading" || email.trim().toLowerCase() === initialEmail.toLowerCase()}
              className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailStatus === "loading"
                ? "Speichern…"
                : emailStatus === "ok"
                  ? "Gespeichert"
                  : "E-Mail speichern"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
