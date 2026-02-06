import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getMovieById } from "@/lib/movie-data";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { MovieHero } from "@/components/movie/MovieHero";
import { MovieInfo } from "@/components/movie/MovieInfo";
import { MovieEditModal } from "@/components/movie/MovieEditModal";
import { prisma } from "@/lib/db";

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export default async function MovieDetailPage({ params }: Props) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) notFound();

  const [movie, auth] = await Promise.all([
    getMovieById(idNum),
    getAuth(),
  ]);
  if (!movie) notFound();

  const canEdit = auth ? hasEffectiveRole(auth, RoleEnum.EDITOR) : false;
  const canAdmin = auth ? hasEffectiveRole(auth, RoleEnum.ADMIN) : false;

  let users: { id: number; name: string; email: string; role: string }[] = [];
  if (canEdit) {
    const list = await prisma.user.findMany({
      where: { role: { in: [RoleEnum.EDITOR, RoleEnum.ADMIN] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    users = list.map((u) => ({ ...u, role: u.role }));
  }

  const cookieStore = await cookies();
  const backUrlCookie = cookieStore.get("backUrl")?.value;
  let backUrl = backUrlCookie ?? "/movies";
  if (backUrl.startsWith("http")) backUrl = "/movies";
  const referer = (await headers()).get("referer") ?? "";
  if (!backUrlCookie && referer && !referer.includes("/login")) {
    try {
      const refPath = new URL(referer).pathname;
      if (refPath !== `/movies/${idNum}`) backUrl = referer;
    } catch {
      // Referer ungültig
    }
  }

  return (
    <>
      <MovieHero
        movie={movie}
        backUrl={backUrl}
        canEdit={canEdit}
        canAdmin={canAdmin}
      />
      <MovieInfo movie={movie} canEdit={canEdit} />
      {canEdit && (
        <MovieEditModal
          movie={movie}
          users={users}
        />
      )}
    </>
  );
}
