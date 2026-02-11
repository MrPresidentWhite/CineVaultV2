import { NextResponse } from "next/server";

/**
 * GET /api/v1
 * Öffentliche Basis-Route: zeigt API-Info.
 * Geschützte Routen unter /api/v1/* können getApiSessionFromRequest(request) nutzen.
 */
export async function GET() {
  return NextResponse.json({
    api: "v1",
    docs: "Challenge-Response-Auth: POST /api/v1/auth/challenge, dann POST /api/v1/auth/verify",
  });
}
