import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi-spec";
import { APP_URL } from "@/lib/env";

const API_BASE = "/api/v1";

/**
 * GET /api/openapi
 * Liefert die OpenAPI-3.0-Spec für Swagger UI (JSON).
 * Server-URL, Beschreibung und Standard für Try-it-out je nach Umgebung
 * (Dev = localhost:3000, Prod = APP_URL). Erster Server = Default in Swagger.
 */
export async function GET() {
  const base = APP_URL.replace(/\/+$/, "");
  const isLocal = base.includes("localhost") || base.includes("127.0.0.1");
  const primaryUrl = isLocal
    ? "http://localhost:3000" + API_BASE
    : base + API_BASE;

  // Erster Server = Default für Try-it-out und überall in der UI
  const servers = [
    {
      url: primaryUrl,
      description: isLocal ? "Lokal (localhost)" : "Produktion",
    },
    { url: API_BASE, description: "Relativ (gleiche Origin)" },
  ];

  const serverHint = `\n\n**Aktueller Server:** \`${primaryUrl}\``;
  const info = {
    ...openApiSpec.info,
    description: (openApiSpec.info.description ?? "").trimEnd() + serverHint,
  };

  return NextResponse.json(
    { ...openApiSpec, servers, info },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
