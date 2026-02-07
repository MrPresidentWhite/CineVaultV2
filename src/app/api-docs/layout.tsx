import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API-Dokumentation | CineVault",
  description:
    "OpenAPI/Swagger-Dokumentation der CineVault API v1 mit Challenge-Response-Authentifizierung.",
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
