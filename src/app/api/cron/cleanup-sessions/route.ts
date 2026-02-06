/**
 * Cron: Abgelaufene Sessions löschen.
 * Aufruf z. B. täglich 3:00 Uhr via Vercel Cron oder externem Scheduler.
 * Geschützt durch CRON_SECRET (Header: Authorization: Bearer <CRON_SECRET>).
 */

import { NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/session/store";
import { CRON_SECRET } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  try {
    const deleted = await cleanupExpiredSessions();
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    console.error("[cron/cleanup-sessions]", e);
    return NextResponse.json(
      { error: "Cleanup failed", message: String(e) },
      { status: 500 }
    );
  }
}
