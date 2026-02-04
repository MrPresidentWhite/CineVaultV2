import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0D0D0D]">
      {/* Hintergrund: login-backdrop */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/assets/login-backdrop.jpeg"
          alt=""
          fill
          className="object-cover opacity-40"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#0D0D0D]/80" aria-hidden />
      </div>

      {/* Header mit Logo-Icon */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/assets/logo-icon.svg"
            alt="CineVault"
            width={40}
            height={40}
            className="h-10 w-10"
          />
          <span className="text-lg font-semibold text-white">CineVault</span>
        </Link>
        <nav className="flex gap-4 text-sm text-white/80">
          <Link href="/" className="hover:text-white">
            Start
          </Link>
          <Link href="/login" className="hover:text-white">
            Anmelden
          </Link>
        </nav>
      </header>

      {/* Hero mit großem Logo und login-bg als Akzent */}
      <main className="relative z-10 flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-6 py-16">
        <div className="relative flex w-full max-w-2xl flex-col items-center gap-8 text-center">
          {/* Großes Logo */}
          <div className="relative">
            <Image
              src="/assets/logo-big.svg"
              alt="CineVault"
              width={320}
              height={120}
              className="h-auto w-full max-w-[320px]"
              priority
            />
          </div>
          <p className="max-w-md text-lg text-white/90">
            Deine Film- und Seriensammlung an einem Ort.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-[#DC3545] px-6 py-3 font-medium text-white transition hover:bg-[#c42d3d]"
            >
              Loslegen
            </Link>
            <Link
              href="/collections"
              className="rounded-full border border-white/30 px-6 py-3 font-medium text-white transition hover:bg-white/10"
            >
              Sammlungen
            </Link>
          </div>
        </div>

        {/* Dekoratives Bild (login-bg) unten im Hero – optional als Karte */}
        <div className="mt-16 w-full max-w-md overflow-hidden rounded-xl border border-white/10 shadow-2xl">
          <Image
            src="/assets/login-bg.jpeg"
            alt=""
            width={600}
            height={400}
            className="h-auto w-full object-cover"
          />
        </div>
      </main>
    </div>
  );
}
