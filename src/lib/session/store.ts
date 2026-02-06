/**
 * Session-Store: Sessions in Prisma (DB) speichern/lesen.
 * Ersetzt express-session Store für Next.js.
 * Im Dev-Modus: nur eine Session pro User (andere werden entfernt).
 */

import { prisma } from "@/lib/db";
import { isDev, ENVIRONMENT } from "@/lib/env";

const ENV_RAW = isDev ? "dev" : (ENVIRONMENT === "prod" ? "prod" : ENVIRONMENT.toLowerCase());
/** DB-Spalte environment ist VARCHAR(10). */
const SESSION_ENV = ENV_RAW.slice(0, 10);

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

/** DB-Spalte ipAddress ist VARCHAR(45); x-forwarded-for kann mehrere IPs enthalten. */
const IP_ADDRESS_MAX_LENGTH = 45;

function normalizeIpAddress(ip: string | null | undefined): string | undefined {
  if (ip == null || !ip.trim()) return undefined;
  const first = ip.split(",")[0]?.trim() ?? ip.trim();
  if (first.length <= IP_ADDRESS_MAX_LENGTH) return first;
  return first.slice(0, IP_ADDRESS_MAX_LENGTH);
}

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

  const ipAddress = normalizeIpAddress(meta?.ipAddress);

  await prisma.session.upsert({
    where: { sid },
    update: {
      data,
      expiresAt,
      userId,
      ipAddress,
      userAgent: meta?.userAgent ?? undefined,
      environment: SESSION_ENV,
      lastSeenAt: new Date(),
    },
    create: {
      sid,
      data,
      expiresAt,
      userId,
      ipAddress,
      userAgent: meta?.userAgent ?? undefined,
      environment: SESSION_ENV,
      lastSeenAt: new Date(),
      createdAt: new Date(),
    },
  });

  if (isDev && userId != null) {
    await prisma.session.deleteMany({
      where: { userId, sid: { not: sid }, environment: "dev" },
    });
  }
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

  if (isDev && session.userId != null) {
    const userId = Number(session.userId);
    if (userId > 0) {
      await prisma.session.deleteMany({
        where: { userId, sid: { not: sid }, environment: "dev" },
      });
    }
  }
}

/** Abgelaufene Sessions löschen (z. B. Cron). */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
