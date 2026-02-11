"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SkeletonImage } from "@/components/ui/SkeletonImage";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  profileImageKey: string | null;
  profileBannerKey?: string | null;
  isMasterAdmin: boolean;
  mustChangePassword: boolean;
  locked: boolean;
  totpEnabledAt: Date | null;
  createdAt: Date;
  avatarUrl: string | null;
  bannerUrl?: string | null;
};

type Props = { users: UserRow[]; currentUserId: number };

export function AdminUsersClient({ users, currentUserId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tempReset, setTempReset] = useState<{
    userId: number;
    name: string;
    email: string;
    temp: string;
  } | null>(null);
  const [editModal, setEditModal] = useState<UserRow | null>(null);

  const disableEdit = (u: UserRow) =>
    u.isMasterAdmin && (currentUserId !== u.id);

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const editorCount = users.filter((u) => u.role === "EDITOR").length;
  const lockedCount = users.filter((u) => u.locked).length;
  const masterCount = users.filter((u) => u.isMasterAdmin).length;

  const masters = users.filter((u) => u.isMasterAdmin);
  const admins = users.filter((u) => !u.isMasterAdmin && u.role === "ADMIN");
  const editors = users.filter((u) => !u.isMasterAdmin && u.role === "EDITOR");
  const viewers = users.filter((u) => !u.isMasterAdmin && u.role === "VIEWER");

  const renderUserCard = (u: UserRow) => (
    <div
      key={u.id}
      className="rounded-xl border border-ring bg-bg/30 overflow-hidden flex flex-col"
    >
      {/* Banner (optional) */}
      <div className="relative h-16 border-b border-ring/60">
        {u.bannerUrl ? (
          <SkeletonImage
            src={u.bannerUrl}
            alt=""
            fill
            className="object-cover"
            containerClassName="absolute inset-0"
            unoptimized={u.bannerUrl.startsWith("http")}
            sizes="(max-width: 1024px) 100vw, 33vw"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-accent/20 via-white/5 to-bg" />
        )}
        <div className="absolute inset-0 bg-black/35" />
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-full overflow-hidden bg-ring flex items-center justify-center text-lg font-bold text-text/80 shrink-0">
            {u.avatarUrl ? (
              <SkeletonImage
                src={u.avatarUrl}
                alt={u.name}
                width={48}
                height={48}
                className="h-full w-full object-cover"
                skeletonClassName="rounded-full"
                unoptimized={u.avatarUrl.startsWith("http")}
              />
            ) : (
              (u.name || "?").slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text truncate">{u.name}</p>
            <p className="text-sm text-text/60 truncate">{u.email}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              <span
                className={`inline-flex rounded-full border px-1.5 py-0.5 text-xs font-semibold ${
                  u.role === "ADMIN"
                    ? "border-brand-ruby/50 bg-brand-ruby/20 text-brand-ruby"
                    : u.role === "EDITOR"
                      ? "border-green-500/50 bg-green-500/20 text-green-400"
                      : "border-blue-500/50 bg-blue-500/20 text-blue-400"
                }`}
              >
                {u.role}
              </span>
              {u.isMasterAdmin && (
                <span className="inline-flex rounded-full border border-purple-500/50 bg-purple-500/20 px-1.5 py-0.5 text-xs font-semibold text-purple-300">
                  MASTER
                </span>
              )}
              {u.mustChangePassword && (
                <span className="rounded-full border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
                  PW-Änderung
                </span>
              )}
              {u.locked && (
                <span className="rounded-full border border-brand-ruby/50 bg-brand-ruby/20 px-1.5 py-0.5 text-xs text-brand-ruby">
                  GESPERRT
                </span>
              )}
              {u.totpEnabledAt && (
                <span className="rounded-full border border-green-500/50 bg-green-500/20 px-1.5 py-0.5 text-xs text-green-400">
                  2FA
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-ring/80">
          <button
            type="button"
            disabled={disableEdit(u)}
            onClick={() => setEditModal(u)}
            className="rounded-lg border border-ring bg-bg px-3 py-1.5 text-sm text-text hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bearbeiten
          </button>
          <button
            type="button"
            disabled={disableEdit(u)}
            onClick={() => handlePasswordReset(u.id)}
            className="rounded-lg border border-ring bg-bg px-3 py-1.5 text-sm text-text hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Passwort zurücksetzen
          </button>
          {u.totpEnabledAt && (
            <button
              type="button"
              onClick={() => handleDisable2Fa(u.id, u.name)}
              className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/20"
            >
              2FA Deaktivieren
            </button>
          )}
          {!u.isMasterAdmin && (
            <button
              type="button"
              onClick={() => handleToggleLock(u.id)}
              className="rounded-lg border border-ring bg-bg px-3 py-1.5 text-sm text-text hover:bg-white/5"
            >
              {u.locked ? "Entsperren" : "Sperren"}
            </button>
          )}
          {!u.isMasterAdmin && (
            <button
              type="button"
              onClick={() => handleDelete(u.id, u.name)}
              className="rounded-lg border border-brand-ruby/50 bg-brand-ruby/10 px-3 py-1.5 text-sm text-brand-ruby hover:bg-brand-ruby/20"
            >
              Löschen
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderGroup = (title: string, subtitle: string, list: UserRow[]) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <p className="mt-0.5 text-sm text-text/60">{subtitle}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(renderUserCard)}
        </div>
      </div>
    );
  };

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        password: fd.get("password"),
        role: fd.get("role") || "VIEWER",
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setSuccess("Nutzer angelegt.");
      form.reset();
      router.refresh();
    } else {
      setError(data.error ?? "Anlegen fehlgeschlagen.");
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editModal) return;
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch(`/api/admin/users/${editModal.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        role: fd.get("role"),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setEditModal(null);
      setSuccess("Benutzer aktualisiert.");
      router.refresh();
    } else {
      setError(data.error ?? "Aktualisierung fehlgeschlagen.");
    }
  }

  async function handlePasswordReset(userId: number) {
    setError(null);
    setTempReset(null);
    const res = await fetch(`/api/admin/users/${userId}/password-reset`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.ok) {
      setTempReset({
        userId: data.user.id,
        name: data.user.name,
        email: data.user.email,
        temp: data.tempPassword,
      });
      setSuccess("Temporäres Passwort gesetzt.");
      router.refresh();
    } else {
      setError(data.error ?? "Zurücksetzen fehlgeschlagen.");
    }
  }

  async function handleToggleLock(userId: number) {
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/toggle-lock`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.ok) {
      setSuccess(data.locked ? "Benutzer gesperrt." : "Benutzer entsperrt.");
      router.refresh();
    } else {
      setError(data.error ?? "Aktion fehlgeschlagen.");
    }
  }

  async function handleDisable2Fa(userId: number, name: string) {
    if (
      !confirm(
        `2FA für „${name}" wirklich deaktivieren? Der Benutzer kann sich danach wieder ohne 2FA-Code anmelden.`
      )
    )
      return;
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/disable-2fa`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.ok) {
      setSuccess("2FA für den Benutzer deaktiviert.");
      router.refresh();
    } else {
      setError(data.error ?? "2FA-Deaktivierung fehlgeschlagen.");
    }
  }

  async function handleDelete(userId: number, name: string) {
    if (!confirm(`Benutzer „${name}" wirklich löschen?`)) return;
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/delete`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.ok) {
      setSuccess("Benutzer gelöscht.");
      router.refresh();
    } else {
      setError(data.error ?? "Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-brand-ruby/50 bg-brand-ruby/10 px-4 py-3 text-sm text-brand-ruby">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          {success}
        </div>
      )}
      {tempReset && (
        <div className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-accent">
          <strong>Temporäres Passwort für {tempReset.name}:</strong>{" "}
          <code className="ml-1 rounded bg-black/30 px-1.5 py-0.5 font-mono">
            {tempReset.temp}
          </code>
          <button
            type="button"
            onClick={() => setTempReset(null)}
            className="ml-2 text-accent/80 hover:underline"
          >
            Schließen
          </button>
        </div>
      )}

      {/* Abschnitt: Benutzer anlegen */}
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text mb-4">
          Neuen Benutzer anlegen
        </h2>
        <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <label className="block">
            <span className="mb-1 block text-sm text-text/70">Name</span>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-text/70">E-Mail</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-text/70">Passwort</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-text/70">Rolle</span>
            <select
              name="role"
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="w-full rounded-lg border border-accent bg-accent/20 px-4 py-2 font-semibold text-accent hover:bg-accent/30"
            >
              Anlegen
            </button>
          </div>
        </form>
      </section>

      {/* Abschnitt: Bestehende Benutzer */}
      <section className="rounded-xl border border-ring bg-panel p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text">
              Bestehende Benutzer
            </h2>
            <p className="mt-1 text-sm text-text/60">
              {totalUsers} Nutzer · {masterCount} Master · {adminCount} Admin
              {adminCount === 1 ? "" : "s"} · {editorCount} Editor
              {editorCount === 1 ? "" : "en"} · {lockedCount} gesperrt
              {lockedCount === 1 ? "" : "e"}.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {renderGroup(
            "Master Admins",
            "Besondere Accounts mit erweiterten Rechten.",
            masters
          )}
          {renderGroup(
            "Admins",
            "Voller Zugriff auf Administration und Nutzerverwaltung.",
            admins
          )}
          {renderGroup(
            "Editoren",
            "Kann Filme/Serien anlegen und Inhalte pflegen.",
            editors
          )}
          {renderGroup(
            "Viewer",
            "Kann Inhalte ansehen und eigene Einstellungen verwalten.",
            viewers
          )}
        </div>
      </section>

      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-ring bg-panel p-6 shadow-xl">
            <h3 id="edit-modal-title" className="text-lg font-semibold text-text mb-4">
              Benutzer bearbeiten
            </h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <input type="hidden" name="id" value={editModal.id} />
              <label className="block">
                <span className="mb-1 block text-sm text-text/70">Name</span>
                <input
                  type="text"
                  name="name"
                  defaultValue={editModal.name}
                  required
                  className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-text/70">E-Mail</span>
                <input
                  type="email"
                  name="email"
                  defaultValue={editModal.email}
                  required
                  className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-text/70">Rolle</span>
                <select
                  name="role"
                  defaultValue={editModal.role}
                  className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="EDITOR">Editor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="rounded-lg border border-ring bg-bg px-4 py-2 text-text hover:bg-white/5"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-accent bg-accent/20 px-4 py-2 font-semibold text-accent hover:bg-accent/30"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
