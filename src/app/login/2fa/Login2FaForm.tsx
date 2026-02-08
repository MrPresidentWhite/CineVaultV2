"use client";

import { useRef, useState } from "react";

type Props = {
  callbackUrl: string;
  initialError?: string;
};

export function Login2FaForm({ callbackUrl, initialError }: Props) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const submittedRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittedRef.current) return;
    submittedRef.current = true;

    const form = e.currentTarget;
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (btn) btn.disabled = true;

    const code = (form.elements.namedItem("code") as HTMLInputElement)?.value?.trim()?.replace(/\s/g, "") ?? "";
    const trustDevice = (form.elements.namedItem("trustDevice") as HTMLInputElement)?.checked ?? false;

    if (!code) {
      setError("Code fehlt.");
      if (btn) btn.disabled = false;
      submittedRef.current = false;
      return;
    }

    try {
      const res = await fetch("/api/auth/login/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, trustDevice, callbackUrl }),
        credentials: "same-origin",
        redirect: "manual",
      });

      if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
        const location = res.headers.get("Location") ?? res.url;
        if (location) {
          window.location.href = location;
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Code ungültig oder bereits verwendet.");
        submittedRef.current = false;
        if (btn) btn.disabled = false;
        return;
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      submittedRef.current = false;
      if (btn) btn.disabled = false;
    }
  };

  return (
    <form
      method="POST"
      action="/api/auth/login/2fa"
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
    >
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-950/80 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        Code (6-stelliger TOTP-Code oder Backup-Code z. B. XXXX-XXXX)
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          placeholder="000000 oder XXXX-XXXX"
          maxLength={12}
          className="rounded-md border-0 bg-[#333] px-3 py-3 text-white placeholder:text-white/60 font-mono text-center tracking-widest"
        />
      </label>

      <label className="flex cursor-pointer items-center gap-2 py-2.5 text-[13px] text-[#ddd]">
        <input type="checkbox" name="trustDevice" value="1" className="rounded" />
        <span>Dieses Gerät 30 Tage als vertrauenswürdig speichern</span>
      </label>

      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <button
        type="submit"
        className="mt-4 min-h-[48px] rounded-md border-0 bg-gold px-4 py-3 font-bold text-black transition hover:bg-[#e6c200] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Bestätigen
      </button>
    </form>
  );
}
