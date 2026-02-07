import Image from "next/image";
import Link from "next/link";

type SearchParams = { error?: string; callbackUrl?: string };

export default async function Login2FaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/";
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <>
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
          <h1 className="m-0 text-2xl font-bold text-white">2FA-Code</h1>
          <p className="text-sm text-[#ccc]">
            Gib den 6-stelligen Code aus deiner Authenticator-App ein oder einen Backup-Code.
          </p>

          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-950/80 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <form
            method="POST"
            action="/api/auth/login/2fa"
            className="flex flex-col gap-5"
          >
            <label className="flex flex-col gap-1.5 text-sm">
              Code (6-stelliger TOTP-Code oder Backup-Code z. B. XXXX-XXXX)
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
              className="mt-4 min-h-[48px] rounded-md border-0 bg-gold px-4 py-3 font-bold text-black transition hover:bg-[#e6c200]"
            >
              Bestätigen
            </button>
          </form>

          <p className="text-[13px] text-[#aaa]">
            <Link href="/login" className="text-gold hover:underline">
              Zurück zum Login
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
