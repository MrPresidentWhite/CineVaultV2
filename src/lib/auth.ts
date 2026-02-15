/**
 * Auth helpers: load user from session, check roles.
 * For Server Components and Route Handlers.
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
  /** Effective role (viewAsRole or user.role). */
  effectiveRole: Role;
};

/**
 * Load current session and associated user from DB.
 * Returns null if no session, user does not exist, or user is locked.
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
 * Like getAuth, but redirects to login page when auth is missing.
 * Use only in Server Components or Route Handlers (uses next/navigation redirect).
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

/** Check if user has at least the given role (ADMIN > EDITOR > VIEWER). */
export function hasRole(user: { role: Role }, role: Role): boolean {
  const order: Role[] = [RoleEnum.VIEWER, RoleEnum.EDITOR, RoleEnum.ADMIN];
  return order.indexOf(user.role) >= order.indexOf(role);
}

/** Check if effective role is at least the given role. */
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
