"use client";

import { useState, useRef } from "react";
import {
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

type Props = { callbackUrl: string };

export function PasskeyLoginButton({ callbackUrl }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const handleClick = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const optsRes = await fetch("/api/auth/passkey/authenticate/options", {
        method: "POST",
        credentials: "include",
      });
      const optsData = await optsRes.json();
      if (!optsRes.ok) {
        setError(optsData.error ?? "Optionen konnten nicht geladen werden.");
        return;
      }
      const options = optsData.options as PublicKeyCredentialRequestOptionsJSON | undefined;
      if (!options) {
        setError("Keine Optionen erhalten.");
        return;
      }
      const response = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/passkey/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response, callbackUrl }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      if (verifyData.ok && verifyData.redirect) {
        window.location.href = verifyData.redirect;
        return;
      }
      setError("Unerwartete Antwort.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Passkey-Anmeldung fehlgeschlagen."
      );
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="relative flex items-center gap-3">
        <span className="flex-1 border-t border-white/20" aria-hidden />
        <span className="text-xs text-white/60">oder</span>
        <span className="flex-1 border-t border-white/20" aria-hidden />
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full min-h-[48px] rounded-md border border-white/30 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        {loading ? "…" : "Mit Passkey anmelden"}
      </button>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
