import { NextResponse } from "next/server";

const SWAGGER_UI_VERSION = "5.31.0";

/**
 * Liefert eine eigenständige HTML-Seite mit Swagger UI (CDN).
 * Kein App-CSS, kein Tailwind – nur Swagger, für maximale Style-Isolation.
 * Wird von /api-docs per iframe geladen.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>CineVault API – Dokumentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css"/>
  <style>
    /* Tag-Beschreibung unter der Überschrift statt daneben */
    .swagger-ui .opblock-tag { flex-direction: column; align-items: stretch; }
    .swagger-ui .opblock-tag > div:first-child { flex-direction: column !important; align-items: flex-start !important; text-align: left; }
    .swagger-ui .opblock-tag .opblock-tag-section { margin-top: 0.5rem; width: 100%; }
  </style>
</head>
<body style="margin:0;background:#fafafa;">
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      var specUrl = window.location.origin + '/api/openapi';
      window.ui = SwaggerUIBundle({
        url: specUrl,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true,
        persistAuthorization: true,
        docExpansion: "list",
        withCredentials: true
      });
    };
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
