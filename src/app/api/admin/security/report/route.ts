import { NextResponse } from "next/server";
import { getAuth, hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

/**
 * GET /api/admin/security/report?days=7
 * Liefert Security-Report: Fehlversuche (Login/2FA) pro IP und pro Account,
 * Nutzer mit temporärer Sperre (lockedUntil). Erfordert ADMIN.
 */
export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.ADMIN)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days");
  const days = Math.min(
    MAX_DAYS,
    Math.max(1, parseInt(daysParam ?? String(DEFAULT_DAYS), 10) || DEFAULT_DAYS)
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [failures, byIdentifierRaw, byIpRaw, usersWithLock] = await Promise.all([
    prisma.loginFailure.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        ipAddress: true,
        identifier: true,
        type: true,
        createdAt: true,
      },
    }),
    prisma.loginFailure.groupBy({
      by: ["identifier"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _max: { createdAt: true },
    }),
    prisma.loginFailure.groupBy({
      by: ["ipAddress"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _max: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { lockedUntil: { gt: new Date() } },
      select: {
        id: true,
        email: true,
        name: true,
        lockedUntil: true,
      },
      orderBy: { lockedUntil: "desc" },
    }),
  ]);

  const identifierToUser = new Map<number, { email: string; name: string }>();
  const userIds = [...new Set(
    byIdentifierRaw
      .filter((r) => r.identifier.startsWith("user:"))
      .map((r) => parseInt(r.identifier.slice(5), 10))
      .filter((n) => Number.isFinite(n))
  )];
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    for (const u of users) {
      identifierToUser.set(u.id, { email: u.email, name: u.name });
    }
  }

  const byAccount = byIdentifierRaw.map((r) => {
    const isUser = r.identifier.startsWith("user:");
    const userId = isUser ? parseInt(r.identifier.slice(5), 10) : null;
    const user = userId != null && Number.isFinite(userId) ? identifierToUser.get(userId) : null;
    return {
      identifier: r.identifier,
      count: r._count.id,
      lastAt: r._max.createdAt,
      isUserId: isUser,
      userName: user?.name ?? null,
      userEmail: user?.email ?? null,
    };
  }).sort((a, b) => b.count - a.count);

  const byIp = byIpRaw.map((r) => ({
    ipAddress: r.ipAddress,
    count: r._count.id,
    lastAt: r._max.createdAt,
  })).sort((a, b) => b.count - a.count);

  return NextResponse.json({
    days,
    since: since.toISOString(),
    recent: failures,
    byAccount,
    byIp,
    usersWithLock,
  });
}
