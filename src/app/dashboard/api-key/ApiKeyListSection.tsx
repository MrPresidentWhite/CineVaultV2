"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ApiKeyRow = {
  id: string;
  label: string | null;
  fingerprint: string | null;
  createdAt: string;
  expiresAt: string | null;
  isActiveKey: boolean;
};

type Props = {
  refetchTrigger?: number;
};

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-DE");
}

/** ISO-Datum oder null → Wert für <input type="date"> (YYYY-MM-DD oder leer). */
function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function validateExpiresAt(value: string): string | null {
  if (!value.trim()) return null;
  if (!ISO_DATE_REGEX.test(value.trim())) return "Format: YYYY-MM-DD";
  const d = new Date(value.trim() + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return "Ungültiges Datum";
  return null;
}

export function ApiKeyListSection({ refetchTrigger = 0 }: Props) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<ApiKeyRow | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editExpiresAtError, setEditExpiresAtError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  /** Ungefähre Höhe des Dropdown-Menüs (3 Einträge) für Platzberechnung. */
  const MENU_APPROX_HEIGHT = 140;
  const [activeLoadingId, setActiveLoadingId] = useState<string | null>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/api-key");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Keys konnten nicht geladen werden.");
        setKeys([]);
        return;
      }
      setKeys(data.keys ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [refetchTrigger]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuOpenId &&
        menuPortalRef.current &&
        !menuPortalRef.current.contains(target)
      ) {
        setMenuOpenId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpenId]);

  const closeModal = () => {
    setEditKey(null);
    setEditLabel("");
    setEditExpiresAt("");
    setEditExpiresAtError(null);
    if (modalRef.current) {
      modalRef.current.hidden = true;
      modalRef.current.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
    }
  };

  useEffect(() => {
    const modal = modalRef.current;
    const dialog = dialogRef.current;
    if (!modal || !dialog) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    };
    const onBackdrop = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".modal__backdrop")) closeModal();
    };
    const onCloseBtn = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-close]")) closeModal();
    };

    modal.addEventListener("keydown", onKey);
    modal.addEventListener("click", onBackdrop);
    modal.addEventListener("click", onCloseBtn);
    return () => {
      modal.removeEventListener("keydown", onKey);
      modal.removeEventListener("click", onBackdrop);
      modal.removeEventListener("click", onCloseBtn);
    };
  }, []);

  const openEditModal = (key: ApiKeyRow) => {
    setEditKey(key);
    setEditLabel(key.label ?? "");
    setEditExpiresAt(isoToDateInput(key.expiresAt));
    setEditExpiresAtError(null);
    setMenuOpenId(null);
    setMenuPosition(null);
    if (modalRef.current) {
      modalRef.current.hidden = false;
      modalRef.current.removeAttribute("aria-hidden");
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
    }
  };

  const handleSetActive = async (id: string) => {
    setActiveLoadingId(id);
    try {
      const res = await fetch(`/api/dashboard/api-key/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActiveKey: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.key) {
        setKeys((prev) =>
          prev.map((k) => ({
            ...k,
            isActiveKey: k.id === id,
          }))
        );
      }
    } finally {
      setActiveLoadingId(null);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editKey) return;
    const expiresError = validateExpiresAt(editExpiresAt);
    setEditExpiresAtError(expiresError);
    if (expiresError) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/dashboard/api-key/${editKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editLabel.trim() || null,
          expiresAt: editExpiresAt.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.key) {
        setKeys((prev) =>
          prev.map((k) =>
            k.id === editKey.id
              ? { ...k, label: data.key.label, expiresAt: data.key.expiresAt }
              : k
          )
        );
        closeModal();
      } else if (data?.error && res.status === 400 && String(data.error).toLowerCase().includes("ablauf")) {
        setEditExpiresAtError(data.error);
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleDownloadPublicKey = async (keyRow: ApiKeyRow) => {
    setMenuOpenId(null);
    setMenuPosition(null);
    try {
      const res = await fetch(`/api/dashboard/api-key/${keyRow.id}/public-key`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Public Key konnte nicht geladen werden.");
        return;
      }
      const contentDisposition = res.headers.get("Content-Disposition");
      const match = contentDisposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `cinevault-${keyRow.label ?? keyRow.id}.pub`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Fehler beim Herunterladen des Public Keys.");
    }
  };

  const handleDelete = async (id: string) => {
    setMenuOpenId(null);
    setMenuPosition(null);
    try {
      const res = await fetch(`/api/dashboard/api-key/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } catch {
      // ignore
    }
  };

  if (loading && keys.length === 0) {
    return (
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Gespeicherte Keys</h2>
        <p className="mt-2 text-sm text-text/60">Lade…</p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Gespeicherte Keys</h2>
        {error && (
          <p className="mt-2 text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
        {keys.length === 0 && !error ? (
          <p className="mt-2 text-sm text-text/60">
            Noch keine SSH-Keys gespeichert. Lade oben einen Key hoch.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ring text-left text-text/70">
                  <th className="w-10 py-2 pr-2 font-medium">Aktiv</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Fingerprint</th>
                  <th className="py-2 pr-3 font-medium">Erstellt</th>
                  <th className="py-2 pr-3 font-medium">Ablauf</th>
                  <th className="w-10 py-2 font-medium" aria-label="Aktionen" />
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr
                    key={key.id}
                    className="border-b border-ring/70 text-text hover:bg-bg/50"
                  >
                    <td className="py-2 pr-2">
                      <label className="flex cursor-pointer items-center justify-center">
                        <input
                          type="radio"
                          name="activeKey"
                          checked={key.isActiveKey}
                          disabled={activeLoadingId === key.id}
                          onChange={() => handleSetActive(key.id)}
                          className="h-4 w-4 border-ring bg-bg text-accent focus:ring-accent focus:ring-offset-0"
                          aria-label={`${key.label ?? key.id} als aktiven Key setzen`}
                        />
                      </label>
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      {key.label ?? "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-text/80">
                      {key.fingerprint ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-text/80">
                      {formatDate(key.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-text/80">
                      {formatDate(key.expiresAt)}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const btn = e.currentTarget;
                          if (menuOpenId === key.id) {
                            setMenuOpenId(null);
                            setMenuPosition(null);
                          } else {
                            const rect = btn.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const openAbove = spaceBelow < MENU_APPROX_HEIGHT;
                            const top = openAbove
                              ? rect.top - MENU_APPROX_HEIGHT - 4
                              : rect.bottom + 4;
                            setMenuPosition({
                              top: Math.max(8, top),
                              right: window.innerWidth - rect.right,
                            });
                            setMenuOpenId(key.id);
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text/70 hover:bg-bg hover:text-text"
                        aria-label="Aktionen"
                        aria-expanded={menuOpenId === key.id}
                        aria-haspopup="true"
                      >
                        <span className="inline-flex gap-0.5" aria-hidden>
                          <span className="h-1 w-1 rounded-full bg-current" />
                          <span className="h-1 w-1 rounded-full bg-current" />
                          <span className="h-1 w-1 rounded-full bg-current" />
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Dropdown-Menü im Portal (nicht im Table-Overflow) */}
      {menuOpenId &&
        menuPosition &&
        typeof document !== "undefined" &&
        (() => {
          const keyRow = keys.find((k) => k.id === menuOpenId);
          if (!keyRow) return null;
          return createPortal(
            <div
              ref={menuPortalRef}
              role="menu"
              className="fixed z-[3000] min-w-[200px] rounded-lg border border-ring bg-panel py-1 shadow-lg"
              style={{
                top: `${menuPosition.top}px`,
                right: `${menuPosition.right}px`,
              }}
            >
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-text hover:bg-bg"
                onClick={() => handleDownloadPublicKey(keyRow)}
              >
                Public Key herunterladen
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-text hover:bg-bg"
                onClick={() => openEditModal(keyRow)}
              >
                Bearbeiten
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-bg"
                onClick={() => handleDelete(keyRow.id)}
              >
                Löschen
              </button>
            </div>,
            document.body
          );
        })()}

      {/* Bearbeiten-Modal */}
      <div
        ref={modalRef}
        hidden
        aria-hidden="true"
        className="modal__wrapper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-edit-title"
      >
        <div
          className="modal__backdrop"
          aria-hidden
          onClick={closeModal}
        />
        <div
          ref={dialogRef}
          className="modal__dialog max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="modal__header">
            <h3 id="api-key-edit-title" className="text-lg font-semibold text-text">
              Key bearbeiten
            </h3>
            <button
              type="button"
              data-close
              className="modal__close"
              aria-label="Schließen"
              onClick={closeModal}
            >
              ×
            </button>
          </header>
          <form onSubmit={handleSaveEdit} className="modal__body">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-text/80">
                Name
              </span>
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder="z. B. Laptop, Server"
                maxLength={191}
              />
            </label>
            <label className="block mt-4">
              <span className="mb-1 block text-sm font-medium text-text/80">
                Ablaufdatum <span className="text-text/50 font-normal">(optional)</span>
              </span>
              <input
                type="date"
                value={editExpiresAt}
                onChange={(e) => {
                  setEditExpiresAt(e.target.value);
                  setEditExpiresAtError(validateExpiresAt(e.target.value));
                }}
                onBlur={() => setEditExpiresAtError(validateExpiresAt(editExpiresAt))}
                className={`w-full rounded-lg border bg-bg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-accent ${
                  editExpiresAtError
                    ? "border-red-500 focus:border-red-500"
                    : "border-ring focus:border-accent"
                }`}
                aria-invalid={!!editExpiresAtError}
                aria-describedby={editExpiresAtError ? "edit-expires-error" : undefined}
              />
              {editExpiresAtError && (
                <p id="edit-expires-error" className="mt-1 text-sm text-red-500">
                  {editExpiresAtError}
                </p>
              )}
            </label>
            <div className="modal__footer">
              <button
                type="button"
                className="rounded-lg border border-ring bg-bg/50 px-3 py-2 text-sm text-text hover:bg-bg"
                onClick={closeModal}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="rounded-lg border border-accent bg-accent/20 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
              >
                {editSaving ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
