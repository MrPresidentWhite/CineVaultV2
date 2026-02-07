import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi-spec";
import { APP_URL } from "@/lib/env";

const API_BASE = "/api/v1";

/**
 * GET /api/openapi
 * Liefert die OpenAPI-3.0-Spec für Swagger UI (JSON).
 * Server-URL nach NODE_ENV: development = localhost:3000, production = APP_URL.
 * Erster Server = Default für Try-it-out (damit Try-it-out gegen die laufende Instanz geht).
 */
export async function GET() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const primaryUrl = isDevelopment
    ? "http://localhost:3000" + API_BASE
    : (APP_URL.replace(/\/+$/, "") + API_BASE);

  // Erster Server = Default für Try-it-out und überall in der UI
  const servers = [
    {
      url: primaryUrl,
      description: isDevelopment ? "Lokal (localhost)" : "Produktion",
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
