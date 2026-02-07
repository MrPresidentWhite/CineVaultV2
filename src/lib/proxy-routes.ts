/**
 * Routen-Regeln für den Proxy: welche Pfade welche Mindest-Rolle erfordern.
 * Nur für Proxy (Edge); echte Prüfung erfolgt weiterhin in getAuth() / hasEffectiveRole().
 */

export type RoleLevel = "VIEWER" | "EDITOR" | "ADMIN";

const ROLE_ORDER: RoleLevel[] = ["VIEWER", "EDITOR", "ADMIN"];

/** Pfad-Präfixe, die mindestens diese Rolle erfordern. Längere Präfixe zuerst. */
const ROUTE_RULES: { prefix: string; minRole: RoleLevel }[] = [
  { prefix: "/dashboard/admin", minRole: "ADMIN" },
  { prefix: "/dashboard/import", minRole: "EDITOR" },
  { prefix: "/dashboard/api-key", minRole: "EDITOR" },
  { prefix: "/api/admin/users", minRole: "ADMIN" },
  { prefix: "/api/admin/import", minRole: "EDITOR" },
  { prefix: "/api/dashboard", minRole: "EDITOR" },
];

export function getRequiredRole(pathname: string): RoleLevel | null {
  for (const { prefix, minRole } of ROUTE_RULES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return minRole;
  }
  return null;
}

/** Prüft, ob userRole mindestens required erfüllt (VIEWER < EDITOR < ADMIN). */
export function hasRoleAtLeast(
  userRole: string | undefined,
  required: RoleLevel
): boolean {
  const role = (userRole === "ADMIN" || userRole === "EDITOR" || userRole === "VIEWER"
    ? userRole
    : "VIEWER") as RoleLevel;
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(required);
}
