/**
 * Geräte/Sitzungen für die Profil-Übersicht „Angemeldete Geräte“.
 * Im Dev-Modus: andere Sessions des Users werden vor der Abfrage entfernt.
 */

import { prisma } from "@/lib/db";
import { parseUserAgent } from "@/lib/parse-user-agent";
import type { DeviceType } from "@/lib/device";
import { isDev } from "@/lib/env";

export type DeviceSession = {
  id: string;
  browser: string;
  os: string;
  deviceType: DeviceType;
  ip: string;
  lastSeenAt: Date;
  createdAt: Date;
  isCurrent: boolean;
};

export async function getDevicesForUser(
  userId: number,
  currentSid: string | null
): Promise<DeviceSession[]> {
  if (isDev && currentSid) {
    await prisma.session.deleteMany({
      where: { userId, sid: { not: currentSid }, environment: "dev" },
    });
  }

  const sessions = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      sid: true,
      ipAddress: true,
      userAgent: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  return sessions.map((s) => {
    const parsed = parseUserAgent(s.userAgent);
    return {
      id: s.id,
      browser: parsed.browser,
      os: parsed.os,
      deviceType: parsed.deviceType,
      ip: s.ipAddress ?? "Unbekannt",
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
      isCurrent: currentSid !== null && s.sid === currentSid,
    };
  });
}
