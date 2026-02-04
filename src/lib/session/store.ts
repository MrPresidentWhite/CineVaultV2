/**
 * Session-Store: Sessions in Prisma (DB) speichern/lesen.
 * Ersetzt express-session Store für Next.js.
 */

import { prisma } from "@/lib/db";

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

export type SessionData = {
  userId?: number;
  viewAsRole?: string;
  rememberMe?: boolean;
  cookie?: { maxAge?: number };
  [key: string]: unknown;
};

export async function getSessionFromStore(
  sid: string
): Promise<SessionData | null> {
  const record = await prisma.session.findUnique({
    where: { sid },
    select: { data: true, expiresAt: true },
  });
  if (!record) return null;
  if (new Date(record.expiresAt) < new Date()) {
    await prisma.session.delete({ where: { sid } }).catch(() => {});
    return null;
  }
  return JSON.parse(record.data) as SessionData;
}

export async function setSessionInStore(
  sid: string,
  session: SessionData,
  meta?: { ipAddress?: string | null; userAgent?: string | null }
): Promise<void> {
  const data = JSON.stringify(session);
  const maxAge = session.cookie?.maxAge ?? DEFAULT_MAX_AGE_MS;
  const expiresAt = new Date(Date.now() + maxAge);
  const userId =
    session.userId != null && Number(session.userId) > 0
      ? Number(session.userId)
      : null;

  await prisma.session.upsert({
    where: { sid },
    update: {
      data,
      expiresAt,
      userId,
      ipAddress: meta?.ipAddress ?? undefined,
      userAgent: meta?.userAgent ?? undefined,
      lastSeenAt: new Date(),
    },
    create: {
      sid,
      data,
      expiresAt,
      userId,
      ipAddress: meta?.ipAddress ?? undefined,
      userAgent: meta?.userAgent ?? undefined,
      lastSeenAt: new Date(),
      createdAt: new Date(),
    },
  });
}

export async function destroySessionInStore(sid: string): Promise<void> {
  await prisma.session.delete({ where: { sid } }).catch(() => {});
}

export async function touchSessionInStore(
  sid: string,
  session: SessionData
): Promise<void> {
  const maxAge = session.cookie?.maxAge ?? DEFAULT_MAX_AGE_MS;
  const expiresAt = new Date(Date.now() + maxAge);
  await prisma.session.update({
    where: { sid },
    data: { expiresAt, lastSeenAt: new Date() },
  });
}

/** Abgelaufene Sessions löschen (z. B. Cron). */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
