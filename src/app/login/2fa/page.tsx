import Image from "next/image";
import Link from "next/link";
import { Login2FaForm } from "./Login2FaForm";

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

          <Login2FaForm callbackUrl={callbackUrl} initialError={error} />

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
