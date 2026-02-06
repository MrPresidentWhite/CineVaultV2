"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Props = {
  avatarUrl: string | null;
  bannerUrl: string | null;
  accent: string;
  initial: string;
  userName: string | null;
};

export function ProfileAvatarBannerForm({
  avatarUrl,
  bannerUrl,
  accent,
  initial,
  userName,
}: Props) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [bannerStatus, setBannerStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarStatus("loading");
    const formData = new FormData();
    formData.set("avatar", file);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.ok) {
        setAvatarStatus("ok");
        router.refresh();
        setTimeout(() => window.location.reload(), 400);
      } else {
        setAvatarStatus("error");
        setAvatarError(data.error ?? "Upload fehlgeschlagen");
      }
    } catch {
      setAvatarStatus("error");
      setAvatarError("Netzwerkfehler");
    }
    e.target.value = "";
  }

  async function uploadBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerError(null);
    setBannerStatus("loading");
    const formData = new FormData();
    formData.set("banner", file);
    try {
      const res = await fetch("/api/profile/banner", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.ok) {
        setBannerStatus("ok");
        router.refresh();
        setTimeout(() => window.location.reload(), 400);
      } else {
        setBannerStatus("error");
        setBannerError(data.error ?? "Upload fehlgeschlagen");
      }
    } catch {
      setBannerStatus("error");
      setBannerError("Netzwerkfehler");
    }
    e.target.value = "";
  }

  return (
    <section className="rounded-xl border border-ring bg-panel p-6">
      <h2 className="text-lg font-semibold text-text mb-4">
        Avatar & Banner
      </h2>
      <p className="text-sm text-text/70 mb-4">
        Wähle ein Bild für Avatar und Banner. Max. 5 MB, Formate: JPEG, PNG, WebP, GIF, SVG, AVIF.
      </p>
      <div className="grid gap-6 sm:grid-cols-2 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-text/80 mb-1">
            Avatar
          </label>
          <div className="w-24 h-24 rounded-lg border border-ring bg-ring/30 overflow-hidden shrink-0 mb-2">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={userName ?? "Avatar"}
                width={96}
                height={96}
                className="w-full h-full object-cover"
                unoptimized={avatarUrl.startsWith("http")}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-text/60">
                {initial}
              </div>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif"
            className="sr-only"
            onChange={uploadAvatar}
            disabled={avatarStatus === "loading"}
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarStatus === "loading"}
            className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {avatarStatus === "loading" ? "Wird hochgeladen…" : avatarStatus === "ok" ? "Gespeichert" : "Avatar wählen"}
          </button>
          {avatarError && <p className="mt-1 text-sm text-brand-ruby">{avatarError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-text/80 mb-1">
            Banner
          </label>
          <div
            className="h-24 w-full max-w-xs rounded-lg border border-ring overflow-hidden mb-2"
            style={{ backgroundColor: `color-mix(in oklab, ${accent} 25%, #141414)` }}
          >
            {bannerUrl ? (
              <Image
                src={bannerUrl}
                alt=""
                width={320}
                height={96}
                className="w-full h-full object-cover"
                unoptimized={bannerUrl.startsWith("http")}
              />
            ) : null}
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif"
            className="sr-only"
            onChange={uploadBanner}
            disabled={bannerStatus === "loading"}
          />
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={bannerStatus === "loading"}
            className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bannerStatus === "loading" ? "Wird hochgeladen…" : bannerStatus === "ok" ? "Gespeichert" : "Banner wählen"}
          </button>
          {bannerError && <p className="mt-1 text-sm text-brand-ruby">{bannerError}</p>}
        </div>
      </div>
    </section>
  );
}
