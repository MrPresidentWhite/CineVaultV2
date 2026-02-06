/**
 * Cron: CDN-Warmup – ruft öffentliche Bild-URLs (Poster/Backdrop/Cover/Stills) per GET auf,
 * damit Cloudflare sie am Edge cacht.
 *
 * Aufruf z. B. alle 30 Min via Vercel Cron oder externem Scheduler.
 * Geschützt durch CRON_SECRET (Header: Authorization: Bearer <CRON_SECRET>).
 *
 * Query-Parameter (optional):
 * - scope: movies | collections | series | all (Default: WARMUP_SCOPE bzw. all)
 * - limit: Anzahl Einträge pro Entity (1–5000, Default: WARMUP_LIMIT bzw. 400)
 * - concurrency: parallele Requests (1–24, Default: WARMUP_CONCURRENCY bzw. 10)
 */

import { NextResponse } from "next/server";
import { runCdnWarmup } from "@/lib/cdn-warmup";
import { CRON_SECRET } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get("scope");
  const limitParam = searchParams.get("limit");
  const concurrencyParam = searchParams.get("concurrency");

  const scope =
    scopeParam === "movies" ||
    scopeParam === "collections" ||
    scopeParam === "series" ||
    scopeParam === "all"
      ? scopeParam
      : undefined;

  const limit =
    limitParam != null
      ? Math.min(Math.max(parseInt(limitParam, 10) || 400, 1), 5000)
      : undefined;

  const concurrency =
    concurrencyParam != null
      ? Math.min(Math.max(parseInt(concurrencyParam, 10) || 10, 1), 24)
      : undefined;

  try {
    const result = await runCdnWarmup({ scope, limit, concurrency });
    const status = result.errors.length > 0 ? 207 : 200;
    return NextResponse.json(
      {
        ok: result.errors.length === 0,
        warmed: result.warmed,
        scope: result.scope,
        limit: result.limit,
        concurrency: result.concurrency,
        ...(result.errors.length > 0 && { errors: result.errors }),
      },
      { status }
    );
  } catch (e) {
    console.error("[cron/cdn-warmup]", e);
    return NextResponse.json(
      {
        error: "CDN-Warmup fehlgeschlagen",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
