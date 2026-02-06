import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getSeriesById } from "@/lib/series-data";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { SeriesHero } from "@/components/series/SeriesHero";
import { SeriesSeasons } from "@/components/series/SeriesSeasons";

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export default async function SeriesDetailPage({ params }: Props) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) notFound();

  const [series, auth] = await Promise.all([
    getSeriesById(idNum),
    getAuth(),
  ]);
  if (!series) notFound();

  const canEdit = auth ? hasEffectiveRole(auth, RoleEnum.EDITOR) : false;
  const canAdmin = auth ? hasEffectiveRole(auth, RoleEnum.ADMIN) : false;

  const cookieStore = await cookies();
  const backUrlCookie = cookieStore.get("backUrl")?.value;
  let backUrl = backUrlCookie ?? "/series";
  if (backUrl.startsWith("http")) backUrl = "/series";
  const referer = (await headers()).get("referer") ?? "";
  if (!backUrlCookie && referer && !referer.includes("/login")) {
    try {
      const refPath = new URL(referer).pathname;
      if (refPath !== `/series/${idNum}`) backUrl = referer;
    } catch {
      // Referer ungültig
    }
  }

  return (
    <>
      <SeriesHero series={series} backUrl={backUrl} canAdmin={canAdmin} />
      <SeriesSeasons series={series} canEdit={canEdit} />
    </>
  );
}
