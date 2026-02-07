"use client";

import { useState, useRef } from "react";

const ACCEPT_SSH =
  ".pub,.pem,.key,.ppk,application/x-pem-file,application/octet-stream";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function looksLikePrivateKey(keyContent: string): boolean {
  const t = keyContent.trim();
  return (
    t.includes("-----BEGIN ") &&
    (t.includes("OPENSSH PRIVATE KEY") ||
      t.includes("RSA PRIVATE KEY") ||
      t.includes("EC PRIVATE KEY"))
  );
}

type InputMode = "paste" | "upload";

type Props = {
  onSuccess?: () => void;
};

export function ApiKeySshSection({ onSuccess }: Props) {
  const [mode, setMode] = useState<InputMode>("paste");
  const [keyContent, setKeyContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [expiresAtError, setExpiresAtError] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setKeyContent(text);
    };
    reader.readAsText(file);
    setMessage(null);
  };

  const clearFile = () => {
    setFileName(null);
    setKeyContent("");
    setMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateExpiresAt = (value: string): boolean => {
    if (!value.trim()) {
      setExpiresAtError(null);
      return true;
    }
    if (!ISO_DATE_REGEX.test(value.trim())) {
      setExpiresAtError("Format: YYYY-MM-DD");
      return false;
    }
    const d = new Date(value.trim() + "T12:00:00Z");
    if (Number.isNaN(d.getTime())) {
      setExpiresAtError("Ungültiges Datum");
      return false;
    }
    setExpiresAtError(null);
    return true;
  };

  const handleExpiresAtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setExpiresAt(v);
    validateExpiresAt(v);
  };

  const handleSubmit = async () => {
    setMessage(null);
    if (!keyContent.trim()) return;

    if (!validateExpiresAt(expiresAt)) {
      setMessage({ type: "error", text: "Bitte gültiges Ablaufdatum angeben (YYYY-MM-DD)." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyContent: keyContent.trim(),
          expiresAt: expiresAt.trim() || undefined,
          passphrase: passphrase || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage({
          type: "error",
          text: data?.error ?? "Speichern fehlgeschlagen.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: data?.message ?? "Schlüssel erfolgreich hochgeladen.",
      });
      setKeyContent("");
      setExpiresAt("");
      setPassphrase("");
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  const showPassphraseHint =
    keyContent.trim() &&
    looksLikePrivateKey(keyContent) &&
    !passphrase.trim();

  return (
    <section className="rounded-xl border border-ring bg-panel p-6">
      <h2 className="text-lg font-semibold text-text">SSH-Key</h2>
      <p className="mt-1 text-sm text-text/60">
        Öffentlichen oder privaten SSH-Key einfügen oder als Datei hochladen.
        Unterstützt werden RSA und ED25519 (OpenSSH .pub, .pem, .key, .ppk).
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === "paste"
              ? "bg-accent/20 text-accent ring-1 ring-accent/50"
              : "bg-bg/50 text-text/80 hover:bg-white/5 hover:text-text"
          }`}
        >
          Als Text einfügen
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === "upload"
              ? "bg-accent/20 text-accent ring-1 ring-accent/50"
              : "bg-bg/50 text-text/80 hover:bg-white/5 hover:text-text"
          }`}
        >
          Datei hochladen
        </button>
      </div>

      {mode === "paste" && (
        <div className="mt-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text/80">
              Schlüsselinhalt
            </span>
            <textarea
              name="sshKey"
              value={keyContent}
              onChange={(e) => {
                setKeyContent(e.target.value);
                setMessage(null);
              }}
              placeholder="z. B. ssh-rsa AAAAB3NzaC1yc2E... oder -----BEGIN OPENSSH PRIVATE KEY----- ..."
              rows={8}
              className="w-full rounded-lg border border-ring bg-bg px-3 py-2 font-mono text-sm text-text placeholder:text-text/40 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              spellCheck={false}
            />
          </label>
        </div>
      )}

      {mode === "upload" && (
        <div className="mt-4 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_SSH}
            onChange={handleFileChange}
            className="block w-full max-w-md text-sm text-text/80 file:mr-3 file:rounded-lg file:border-0 file:bg-accent/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/30"
          />
          {fileName && (
            <div className="flex items-center gap-2 rounded-lg border border-ring bg-bg/30 px-3 py-2">
              <span className="text-sm text-text/80">{fileName}</span>
              <button
                type="button"
                onClick={clearFile}
                className="ml-auto text-sm text-text/60 hover:text-text"
              >
                Entfernen
              </button>
            </div>
          )}
          {keyContent && mode === "upload" && (
            <div className="mt-2">
              <span className="mb-1 block text-sm font-medium text-text/80">
                Vorschau
              </span>
              <textarea
                readOnly
                value={keyContent}
                rows={6}
                className="w-full rounded-lg border border-ring bg-bg/50 px-3 py-2 font-mono text-sm text-text/90 outline-none"
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 max-w-2xl">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-text/80">
            Ablaufdatum <span className="text-text/50 font-normal">(optional)</span>
          </span>
          <input
            type="date"
            value={expiresAt}
            onChange={handleExpiresAtChange}
            onBlur={() => validateExpiresAt(expiresAt)}
            className={`w-full rounded-lg border bg-bg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-accent ${
              expiresAtError
                ? "border-red-500 focus:border-red-500"
                : "border-ring focus:border-accent"
            }`}
            aria-invalid={!!expiresAtError}
            aria-describedby={expiresAtError ? "expires-at-error" : undefined}
          />
          {expiresAtError && (
            <p id="expires-at-error" className="mt-1 text-sm text-red-500">
              {expiresAtError}
            </p>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-text/80">
            Passphrase <span className="text-text/50 font-normal">(optional)</span>
          </span>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Falls der Schlüssel geschützt ist"
            autoComplete="off"
            className="w-full rounded-lg border border-ring bg-bg px-3 py-2 text-text placeholder:text-text/40 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </label>
      </div>

      {showPassphraseHint && (
        <p className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Falls der Schlüssel passwortgeschützt ist, bitte Passphrase angeben.
        </p>
      )}

      {message && (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            message.type === "success"
              ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
              : message.type === "error"
                ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
          role="alert"
        >
          {message.text}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          disabled={!keyContent.trim() || loading}
          onClick={handleSubmit}
          className="rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? "Wird gespeichert…" : "Speichern"}
        </button>
      </div>
    </section>
  );
}
