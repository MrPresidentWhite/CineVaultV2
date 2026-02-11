import { SkeletonImage } from "@/components/ui/SkeletonImage";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toPublicUrl } from "@/lib/storage";
import { ProfileNameEmailForm } from "./ProfileNameEmailForm";
import { ProfileAvatarBannerForm } from "./ProfileAvatarBannerForm";

export default async function DashboardProfilePage() {
  const auth = await requireAuth({ callbackUrl: "/dashboard/profile" });
  const userId = auth.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isMasterAdmin: true,
      profileImageKey: true,
      profileBannerKey: true,
      profileBannerColor: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;

  const avatarBase = toPublicUrl(user.profileImageKey) ?? null;
  const bannerBase = toPublicUrl(user.profileBannerKey) ?? null;
  const version = new Date(user.updatedAt).getTime();
  const avatarUrl = avatarBase ? `${avatarBase}${avatarBase.includes("?") ? "&" : "?"}v=${version}` : null;
  const bannerUrl = bannerBase ? `${bannerBase}${bannerBase.includes("?") ? "&" : "?"}v=${version}` : null;
  const accent = user.profileBannerColor ?? "#FFD700";
  const initial = (user.name || "?").slice(0, 1).toUpperCase();
  const roleClass = user.role?.toLowerCase() ?? "viewer";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text tracking-tight">Profil</h1>

      {/* Hero-Karte */}
      <section
        className="relative overflow-hidden rounded-xl border border-ring bg-panel"
        style={{ ["--tw-accent" as string]: accent }}
      >
        {bannerUrl ? (
          <div className="relative h-32 sm:h-40">
            <SkeletonImage
              src={bannerUrl}
              alt=""
              fill
              className="object-cover"
              containerClassName="absolute inset-0"
              unoptimized={bannerUrl.startsWith("http")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-panel to-transparent" />
          </div>
        ) : (
          <div
            className="h-32 sm:h-40 bg-gradient-to-br from-panel to-ring/30"
            style={{ backgroundColor: `color-mix(in oklab, ${accent} 25%, #141414)` }}
          />
        )}
        <div className="relative flex flex-col sm:flex-row gap-6 p-6 -mt-12 sm:-mt-16">
          <div className="shrink-0 w-24 h-24 rounded-full border-4 border-panel bg-panel overflow-hidden shadow-xl">
            {avatarUrl ? (
              <SkeletonImage
                src={avatarUrl}
                alt={user.name}
                width={96}
                height={96}
                className="w-full h-full object-cover"
                skeletonClassName="rounded-full"
                unoptimized={avatarUrl.startsWith("http")}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-text/80 bg-ring/50">
                {initial}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-2 sm:pt-4">
            <h2 className="text-xl font-bold text-text">{user.name}</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  roleClass === "admin"
                    ? "border-brand-ruby/50 bg-brand-ruby/20 text-brand-ruby"
                    : roleClass === "editor"
                      ? "border-green-500/50 bg-green-500/20 text-green-400"
                      : "border-blue-500/50 bg-blue-500/20 text-blue-400"
                }`}
              >
                {user.role}
              </span>
              {user.isMasterAdmin && (
                <span className="inline-flex rounded-full border border-purple-500/50 bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300">
                  MASTER
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-text/70">{user.email}</p>
            <p className="mt-1 text-xs text-text/50">
              Erstellt: {new Date(user.createdAt).toLocaleDateString("de-DE")} · Geändert:{" "}
              {new Date(user.updatedAt).toLocaleDateString("de-DE")}
            </p>
          </div>
        </div>
      </section>

      <ProfileNameEmailForm
        initialName={user.name ?? ""}
        initialEmail={user.email ?? ""}
      />

      <ProfileAvatarBannerForm
        avatarUrl={avatarUrl}
        bannerUrl={bannerUrl}
        accent={accent}
        initial={initial}
        userName={user.name}
      />
    </div>
  );
}
