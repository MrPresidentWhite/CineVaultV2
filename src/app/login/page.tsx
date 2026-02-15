import Image from "next/image";
import { redirect } from "next/navigation";
import { isDev } from "@/lib/env";
import { PasskeyLoginButton } from "./PasskeyLoginButton";

type SearchParams = { success?: string; error?: string; callbackUrl?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string"
      ? params.callbackUrl
      : "/";

  if (isDev) {
    redirect(
      `/api/auth/dev-login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    );
  }

  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <>
      {/* Full-Screen Backdrop (wie altes body.login::before/after) */}
      <div className="fixed inset-0 z-0" aria-hidden>
        <Image
          src="/assets/login-backdrop.jpeg"
          alt=""
          fill
          className="object-cover brightness-[0.4]"
          priority
          sizes="100vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"
          aria-hidden
        />
      </div>

      <div className="relative z-10 mx-auto mt-[6vh] w-[min(400px,92%)] px-2 md:mt-[8vh] md:px-0">
        <div className="flex flex-col gap-5 rounded-lg bg-black/75 p-6 md:p-10">
          <h1 className="m-0 text-2xl font-bold text-white">Login</h1>

          {success && (
            <div className="rounded-lg border border-green-600/50 bg-green-950/80 px-4 py-3 text-sm text-green-100">
              {success}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-950/80 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <form
            method="POST"
            action="/api/auth/login"
            className="flex flex-col gap-5"
          >
            <label className="flex flex-col gap-1.5 text-sm">
              E-Mail
              <input
                type="email"
                name="email"
                required
                className="rounded-md border-0 bg-[#333] px-3 py-3 text-white placeholder:text-white/60"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              Passwort
              <input
                type="password"
                name="password"
                required
                className="rounded-md border-0 bg-[#333] px-3 py-3 text-white placeholder:text-white/60"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2 py-2.5 text-[13px] text-[#ddd]">
              <input type="checkbox" name="remember" value="1" className="rounded" />
              <span>Angemeldet bleiben</span>
            </label>

            {callbackUrl && (
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
            )}

            <button
              type="submit"
              className="mt-4 min-h-[48px] rounded-md border-0 bg-gold px-4 py-3 font-bold text-black transition hover:bg-[#e6c200]"
            >
              Login
            </button>
          </form>

          <PasskeyLoginButton callbackUrl={callbackUrl} />

          <p className="text-[13px] text-[#aaa]">
            Hinweis: Bitte aktiviere „angemeldet bleiben“ nicht auf öffentlichen
            Geräten.
          </p>
        </div>
      </div>
    </>
  );
}
