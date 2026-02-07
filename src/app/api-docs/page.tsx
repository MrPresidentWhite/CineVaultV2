"use client";

/**
 * Lädt die API-Dokumentation in einem iframe (eigenständiges HTML von /api/docs-view).
 * So behält Swagger UI sein natives Design ohne Einfluss durch App-Styles.
 */
export default function ApiDocsPage() {
  return (
    <iframe
      src="/api/docs-view"
      title="CineVault API – Dokumentation"
      className="api-docs-iframe"
    />
  );
}
