"use client";

import { useRef } from "react";

type Props = {
  callbackUrl: string;
  initialError?: string;
};

export function Login2FaForm({ callbackUrl, initialError }: Props) {
  const submittedRef = useRef(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (submittedRef.current) {
      e.preventDefault();
      return;
    }
    submittedRef.current = true;
    const form = e.currentTarget;
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (btn) btn.disabled = true;
    // Native Submit: Browser macht POST und folgt der 302 – kein fetch, kein Download auf Mobile
  };

  return (
    <form
      method="POST"
      action="/api/auth/login/2fa"
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
    >
      {initialError && (
        <div className="rounded-lg border border-red-500/50 bg-red-950/80 px-4 py-3 text-sm text-red-100">
          {initialError}
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
