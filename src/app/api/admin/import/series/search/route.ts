import { NextResponse } from "next/server";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { searchSeries } from "@/lib/tmdb";

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json(
      { ok: false, error: "Nicht berechtigt" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([], { status: 200 });

  try {
    const r = await searchSeries(q, 1);
    const mapped = r.results.map((s) => ({
      id: s.id,
      name: s.name,
      first_air_date: s.first_air_date,
      poster_path: s.poster_path,
      overview: s.overview,
    }));
    return NextResponse.json(mapped);
  } catch (e) {
    console.error("Import searchSeries error:", e);
    return NextResponse.json([], { status: 500 });
  }
}

