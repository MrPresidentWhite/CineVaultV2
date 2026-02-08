/**
 * Auth-Helper: Benutzer aus Session laden, Rollen prüfen.
 * Für Server Components und Route Handlers.
 */

import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import type { UserModel } from "@/generated/prisma/models/User";
import { prisma } from "@/lib/db";
import { getSession, type SessionData } from "@/lib/session";
import { Role as RoleEnum } from "@/generated/prisma/enums";

export type AuthResult = {
  user: UserModel;
  session: SessionData;
  /** Effektive Rolle (viewAsRole oder user.role). */
  effectiveRole: Role;
};

/**
 * Lädt die aktuelle Session und den zugehörigen User aus der DB.
 * Gibt null zurück, wenn keine Session, User nicht existiert oder gesperrt ist.
 */
export async function getAuth(meta?: {
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<AuthResult | null> {
  const session = await getSession(meta);
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user || user.locked) return null;

  const effectiveRole =
    (session.effectiveRole as Role) ??
    (session.viewAsRole as Role) ??
    user.role;

  return { user, session, effectiveRole };
}

/**
 * Wie getAuth, aber leitet bei fehlender Auth auf die Login-Seite um.
 * Nur in Server Components oder Route Handlers verwenden (nutzt next/navigation redirect).
 */
export async function requireAuth(meta?: {
  ipAddress?: string | null;
  userAgent?: string | null;
  callbackUrl?: string;
}): Promise<AuthResult> {
  const auth = await getAuth(meta);
  if (!auth) {
    const url = meta?.callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(meta.callbackUrl)}`
      : "/login";
    redirect(url);
  }
  return auth;
}

/** Prüft, ob der User mindestens die angegebene Rolle hat (ADMIN > EDITOR > VIEWER). */
export function hasRole(user: { role: Role }, role: Role): boolean {
  const order: Role[] = [RoleEnum.VIEWER, RoleEnum.EDITOR, RoleEnum.ADMIN];
  return order.indexOf(user.role) >= order.indexOf(role);
}

/** Prüft, ob die effektive Rolle mindestens die angegebene ist. */
export function hasEffectiveRole(auth: AuthResult, role: Role): boolean {
  const order: Role[] = [RoleEnum.VIEWER, RoleEnum.EDITOR, RoleEnum.ADMIN];
  return order.indexOf(auth.effectiveRole) >= order.indexOf(role);
}

export function isAdmin(user: { role: Role; isMasterAdmin?: boolean }): boolean {
  return user.role === RoleEnum.ADMIN || user.isMasterAdmin === true;
}

export function isEditorOrAbove(user: { role: Role }): boolean {
  return hasRole(user, RoleEnum.EDITOR);
}

export function isViewerOrAbove(user: { role: Role }): boolean {
  return hasRole(user, RoleEnum.VIEWER);
}
