"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken, csrfHeaders, setCsrfToken } from "@/lib/csrf-client";

type Props = { initialEnabled: boolean };

function formatBackupCode(code: string): string {
  const c = code.replace(/\s/g, "").toUpperCase();
  if (c.length >= 8) return `${c.slice(0, 4)}-${c.slice(4, 8)}`;
  return c;
}

export function TwoFactorClient({ initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<"idle" | "qr" | "verify" | "backup" | "disable">("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const submittingRef = useRef(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/dashboard/security/2fa/status");
      const data = await res.json();
      if (data.ok) setEnabled(data.enabled);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleStartSetup = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/dashboard/security/2fa/setup", {
        method: "POST",
        headers: csrfHeaders(token),
      });
      const data = await res.json();
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      if (!res.ok) {
        setError(data.error ?? "Setup fehlgeschlagen.");
        return;
      }
      setQrDataUrl(data.qrDataUrl);
      setManualKey(data.manualKey);
      setStep("qr");
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/dashboard/security/2fa/verify", {
        method: "POST",
        headers: { ...csrfHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.replace(/\s/g, "") }),
      });
      const data = await res.json();
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      if (!res.ok) {
        setError(data.error ?? "Verifizierung fehlgeschlagen.");
        return;
      }
      setBackupCodes(data.backupCodes ?? []);
      setStep("backup");
      setEnabled(true);
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackupCodes = () => {
    if (!backupCodes?.length) return;
    const text = backupCodes.map((c) => formatBackupCode(c)).join("\n");
    const blob = new Blob([`CineVault 2FA Backup-Codes\n\n${text}\n\nJeden Code nur einmal verwenden.`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cinevault-2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTrustDevice = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/dashboard/security/2fa/trust-device", {
        method: "POST",
        headers: csrfHeaders(token),
      });
      const data = await res.json();
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      if (!res.ok) {
        setError(data.error ?? "Fehler.");
        return;
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/dashboard/security/2fa/disable", {
        method: "POST",
        headers: { ...csrfHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode.replace(/\s/g, ""),
        }),
      });
      const data = await res.json();
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      if (!res.ok) {
        setError(data.error ?? "Deaktivierung fehlgeschlagen.");
        return;
      }
      setEnabled(false);
      setStep("idle");
      setDisablePassword("");
      setDisableCode("");
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  if (enabled && step === "idle") {
    return (
      <section className="rounded-xl border border-ring bg-panel p-6 space-y-6">
        <h2 className="text-lg font-semibold text-text">2FA ist aktiviert</h2>
        <p className="text-sm text-text/70">
          Bei jedem Login wird ein 6-stelliger Code aus deiner Authenticator-App abgefragt.
        </p>
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleTrustDevice}
            disabled={loading}
            className="rounded-lg border border-ring bg-bg px-4 py-2 text-sm text-text hover:bg-bg/80 disabled:opacity-50"
          >
            Dieses Gerät als vertrauenswürdig speichern
          </button>
        </div>
        <p className="text-xs text-text/60">
          Vertrauenswürdige Geräte müssen 30 Tage lang keinen 2FA-Code eingeben.
        </p>
        <hr className="border-ring" />
        <h3 className="text-base font-medium text-text">2FA deaktivieren</h3>
        <form onSubmit={handleDisable} className="space-y-4 max-w-md">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text/80">Passwort</span>
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              required
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text/80">
              Aktueller 2FA-Code oder Backup-Code
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="000000 oder XXXX-XXXX"
              required
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-accent font-mono"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg border border-red-500/50 bg-red-950/20 px-4 py-2 text-sm text-red-400 hover:bg-red-950/30 disabled:opacity-50"
          >
            {loading ? "…" : "2FA deaktivieren"}
          </button>
        </form>
      </section>
    );
  }

  if (step === "backup" && backupCodes?.length) {
    return (
      <section className="rounded-xl border border-ring bg-panel p-6 space-y-6">
        <h2 className="text-lg font-semibold text-text">Backup-Codes speichern</h2>
        <p className="text-sm text-text/70">
          Speichere diese Codes sicher. Jeder Code kann nur einmal verwendet werden, falls du keinen
          Zugriff auf deine Authenticator-App hast.
        </p>
        <div className="rounded-lg border border-ring bg-bg/50 p-4 font-mono text-sm text-text/90 grid grid-cols-2 gap-2">
          {backupCodes.map((c, i) => (
            <span key={i}>{formatBackupCode(c)}</span>
          ))}
        </div>
        <button
          type="button"
          onClick={handleDownloadBackupCodes}
          className="rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30"
        >
          Backup-Codes herunterladen
        </button>
        <button
          type="button"
          onClick={() => { setStep("idle"); setBackupCodes(null); router.refresh(); }}
          className="ml-3 rounded-lg border border-ring bg-bg px-4 py-2 text-sm text-text hover:bg-bg/80"
        >
          Fertig
        </button>
      </section>
    );
  }

  if (step === "qr" && (qrDataUrl || manualKey)) {
    return (
      <section className="rounded-xl border border-ring bg-panel p-6 space-y-6">
        <h2 className="text-lg font-semibold text-text">Authenticator-App einrichten</h2>
        <p className="text-sm text-text/70">
          Scanne den QR-Code mit einer App (z. B. Google Authenticator, Authy) oder gib den
          manuellen Schlüssel ein.
        </p>
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-8">
          {qrDataUrl && (
            <div className="rounded-lg border border-ring bg-white p-2 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR-Code für 2FA" width={220} height={220} />
            </div>
          )}
          {manualKey && (
            <div>
              <p className="text-sm font-medium text-text/80 mb-1">Manueller Schlüssel</p>
              <code className="block rounded-lg border border-ring bg-bg/50 px-3 py-2 text-sm text-text break-all font-mono">
                {manualKey}
              </code>
            </div>
          )}
        </div>
        <form onSubmit={handleVerify} className="space-y-4 max-w-sm">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text/80">
              6-stelligen Code aus der App eingeben
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              required
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text text-center text-lg tracking-widest font-mono outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
          >
            {loading ? "…" : "Aktivieren"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-ring bg-panel p-6 space-y-6">
      <h2 className="text-lg font-semibold text-text">Zwei-Faktor-Authentifizierung (2FA)</h2>
      <p className="text-sm text-text/70">
        Mit 2FA schützt du dein Konto mit einem zusätzlichen Code (alle 30 Sekunden neu), den du in
        einer Authenticator-App siehst.
      </p>
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleStartSetup}
        disabled={loading}
        className="rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
      >
        {loading ? "…" : "2FA aktivieren"}
      </button>
    </section>
  );
}
