import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi-spec";

/**
 * GET /api/openapi
 * Liefert die OpenAPI-3.0-Spec für Swagger UI (JSON).
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
