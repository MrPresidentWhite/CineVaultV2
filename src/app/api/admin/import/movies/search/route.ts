import { NextResponse } from "next/server";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { searchMovies } from "@/lib/tmdb";

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([], { status: 200 });

  try {
    const r = await searchMovies(q, 1);
    // Nur die Felder, die der Client braucht
    const mapped = r.results
      .map((m) => ({
        id: m.id,
        title: m.title,
        release_date: m.release_date,
        poster_path: m.poster_path,
        overview: m.overview,
      }))
      // TMDb-Kuriosum: „Filmreihe“-Einträge liefern keine Movie-Details (404) → ausblenden
      .filter((m) => !/filmreihe/i.test(m.title));
    return NextResponse.json(mapped);
  } catch (e) {
    console.error("Import searchMovies error:", e);
    return NextResponse.json([], { status: 500 });
  }
}

