"use client";

import { useState, useEffect, useRef } from "react";
import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser";
import { getCsrfToken, csrfHeaders, setCsrfToken } from "@/lib/csrf-client";

type Credential = {
  id: string;
  name: string | null;
  deviceType: string | null;
  createdAt: string;
};

export function PasskeysClient() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const submittingRef = useRef(false);

  const fetchCredentials = async () => {
    try {
      const res = await fetch("/api/dashboard/security/passkeys", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) setCredentials(data.credentials ?? []);
    } catch {
      setError("Laden fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleAddPasskey = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setRegistering(true);
    try {
      const token = await getCsrfToken();
      const optsRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        headers: csrfHeaders(token),
        credentials: "include",
      });
      let optsData: { ok?: boolean; options?: unknown; error?: string };
      try {
        optsData = await optsRes.json();
      } catch {
        setError(
          optsRes.status === 404
            ? "Passkey-Route nicht gefunden (404). Dev-Server neu starten?"
            : "Ungültige Server-Antwort."
        );
        return;
      }
      if (!optsRes.ok) {
        setError(optsData.error ?? "Optionen konnten nicht geladen werden.");
        return;
      }
      const options = optsData.options as PublicKeyCredentialCreationOptionsJSON | undefined;
      if (!options) {
        setError("Keine Optionen erhalten.");
        return;
      }
      const response = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { ...csrfHeaders(token), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response }),
      });
      let verifyData: { ok?: boolean; csrfToken?: string; error?: string };
      try {
        verifyData = await verifyRes.json();
      } catch {
        setError(
          verifyRes.status === 404
            ? "Passkey-Route nicht gefunden (404)."
            : "Ungültige Server-Antwort."
        );
        return;
      }
      if (verifyData.csrfToken) setCsrfToken(verifyData.csrfToken);
      if (!verifyRes.ok) {
        setError(verifyData.error ?? "Registrierung fehlgeschlagen.");
        return;
      }
      await fetchCredentials();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Passkey-Registrierung fehlgeschlagen."
      );
    } finally {
      setRegistering(false);
      submittingRef.current = false;
    }
  };

  const handleStartRename = (c: Credential) => {
    setEditingId(c.id);
    setEditName(c.name || "");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleSaveRename = async () => {
    if (!editingId || submittingRef.current) return;
    const trimmed = editName.trim();
    submittingRef.current = true;
    setError(null);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/dashboard/security/passkeys/${editingId}`, {
        method: "PATCH",
        headers: { ...csrfHeaders(token), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed || null }),
      });
      const data = await res.json();
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      if (!res.ok) {
        setError(data.error ?? "Umbenennen fehlgeschlagen.");
        return;
      }
      setCredentials((prev) =>
        prev.map((p) =>
          p.id === editingId ? { ...p, name: data.name ?? (trimmed || null) } : p
        )
      );
      handleCancelRename();
    } catch {
      setError("Umbenennen fehlgeschlagen.");
    } finally {
      submittingRef.current = false;
    }
  };

  const handleDelete = async (id: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setDeletingId(id);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/dashboard/security/passkeys/${id}`, {
        method: "DELETE",
        headers: csrfHeaders(token),
        credentials: "include",
      });
      const data = await res.json();
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      if (!res.ok) {
        setError(data.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Löschen fehlgeschlagen.");
    } finally {
      setDeletingId(null);
      submittingRef.current = false;
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return s;
    }
  };

  const formatDeviceType = (dt: string | null) => {
    if (!dt) return "—";
    if (dt === "multiDevice") return "Multi-Device (Sync)";
    if (dt === "singleDevice") return "Single-Device";
    return dt;
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Passkeys</h2>
        <p className="mt-2 text-sm text-text/70">Laden…</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-ring bg-panel p-6 space-y-6">
      <h2 className="text-lg font-semibold text-text">Passkeys</h2>
      <p className="text-sm text-text/70">
        Mit Passkeys kannst du dich ohne Passwort anmelden – per Fingerabdruck,
        Gesichtserkennung oder Security Key.
      </p>
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {credentials.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-base font-medium text-text">Deine Passkeys</h3>
          <ul className="divide-y divide-ring">
            {credentials.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  {editingId === c.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename();
                          if (e.key === "Escape") handleCancelRename();
                        }}
                        autoFocus
                        placeholder="Name eingeben"
                        className="min-w-[120px] max-w-[200px] rounded-lg border border-ring bg-bg px-2 py-1.5 text-sm text-text outline-none focus:ring-1 focus:ring-accent"
                      />
                      <button
                        type="button"
                        onClick={handleSaveRename}
                        className="rounded-lg border border-accent bg-accent/20 px-2 py-1.5 text-xs text-accent hover:bg-accent/30"
                      >
                        Speichern
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelRename}
                        className="text-xs text-text/60 hover:text-text"
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <>
                      <p
                        className="text-sm font-medium text-text cursor-pointer hover:text-accent"
                        onClick={() => handleStartRename(c)}
                        title="Klicken zum Umbenennen"
                      >
                        {c.name || "Unbenannt"}
                      </p>
                      <p className="text-xs text-text/60">
                        {formatDeviceType(c.deviceType)} · {formatDate(c.createdAt)}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {editingId !== c.id && (
                    <button
                      type="button"
                      onClick={() => handleStartRename(c)}
                      className="rounded-lg border border-ring bg-bg px-2 py-1.5 text-xs text-text/80 hover:bg-bg/80"
                      title="Umbenennen"
                    >
                      Umbenennen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    className="rounded-lg border border-red-500/50 bg-red-950/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30 disabled:opacity-50"
                  >
                    {deletingId === c.id ? "…" : "Entfernen"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-text/60">
          Noch kein Passkey registriert. Füge einen hinzu, um dich ohne Passwort
          anmelden zu können.
        </p>
      )}
      <button
        type="button"
        onClick={handleAddPasskey}
        disabled={registering}
        className="rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
      >
        {registering ? "…" : "Passkey hinzufügen"}
      </button>
    </section>
  );
}
