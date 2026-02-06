import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getSearchSuggestions } from "@/lib/search-data";

/**
 * GET /api/search/suggest?q=...
 * Liefert Such-Vorschläge (Filme, Collections, Serien). Erfordert VIEWER.
 */
export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.VIEWER)) {
    return NextResponse.json(
      { movies: [], collections: [], series: [] },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const result = await getSearchSuggestions(q);
  return NextResponse.json(result);
}
