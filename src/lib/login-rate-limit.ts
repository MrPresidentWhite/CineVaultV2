/**
 * Rate-Limiting und Aufzeichnung für Login/2FA (Brute-Force-Schutz).
 * Pro IP und pro Account (E-Mail bzw. user:userId); Fenster 15 Min.
 * Bei bekanntem Gerät (Trust-Cookie) werden Fehlversuche nicht aufgezeichnet.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { AuthFailureType as AuthFailureTypeEnum } from "@/generated/prisma/enums";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 Min
const RATE_LIMIT_MAX_PER_IP = 5;
const RATE_LIMIT_MAX_PER_ACCOUNT = 5;
/** Ab dieser Anzahl Fehlversuche pro Account im Fenster: temporäre Sperre (lockedUntil). */
const LOCK_ACCOUNT_AFTER_FAILURES = 10;
/** Dauer der temporären Sperre in ms (30 Min). */
const LOCK_DURATION_MS = 30 * 60 * 1000;

const IP_MAX_LEN = 45;
const IDENTIFIER_MAX_LEN = 255;

function normalizeIp(ip: string | null | undefined): string | null {
  if (ip == null || !ip.trim()) return null;
  const first = ip.split(",")[0]?.trim() ?? ip.trim();
  if (first.length > IP_MAX_LEN) return first.slice(0, IP_MAX_LEN);
  return first;
}

function normalizeIdentifier(id: string): string {
  const s = String(id ?? "").trim();
  if (s.length > IDENTIFIER_MAX_LEN) return s.slice(0, IDENTIFIER_MAX_LEN);
  return s || "unknown";
}

/**
 * Prüft, ob der Request von einem vertrauenswürdigen Gerät kommt (Trust-Cookie
 * passt zu einem gültigen TrustedDevice des Users). Dann werden Fehlversuche
 * nicht aufgezeichnet (Fettfinger-Toleranz).
 */
export async function isRequestFromTrustedDevice(
  userId: number,
  trustCookieValue: string | null
): Promise<boolean> {
  if (!trustCookieValue?.trim()) return false;
  const tokenHash = createHash("sha256").update(trustCookieValue.trim(), "utf8").digest("hex");
  const device = await prisma.trustedDevice.findFirst({
    where: {
      userId,
      tokenHash,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return !!device;
}

/**
 * Ermittelt die Client-IP aus Request-Headern (z. B. hinter Proxy).
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  return normalizeIp(forwarded ?? real ?? null);
}

const since = () => new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

/**
 * Prüft, ob weitere Login-/2FA-Versuche erlaubt sind (pro IP und optional pro Account).
 * @returns { allowed: true } oder { allowed: false, reason: "ip" | "account" }
 */
export async function checkLoginRateLimit(
  ip: string | null,
  identifier?: string | null
): Promise<{ allowed: boolean; reason?: "ip" | "account" }> {
  if (!ip) return { allowed: true };

  const sinceDate = since();

  const [ipCount, accountCount] = await Promise.all([
    ip
      ? prisma.loginFailure.count({
          where: { ipAddress: ip, createdAt: { gte: sinceDate } },
        })
      : 0,
    identifier
      ? prisma.loginFailure.count({
          where: {
            identifier: normalizeIdentifier(identifier),
            createdAt: { gte: sinceDate },
          },
        })
      : 0,
  ]);

  if (ipCount >= RATE_LIMIT_MAX_PER_IP)
    return { allowed: false, reason: "ip" };
  if (identifier && accountCount >= RATE_LIMIT_MAX_PER_ACCOUNT)
    return { allowed: false, reason: "account" };
  return { allowed: true };
}

/**
 * Zeichnet einen fehlgeschlagenen Login- oder 2FA-Versuch auf.
 * Bei Überschreitung von LOCK_ACCOUNT_AFTER_FAILURES wird das Konto temporär gesperrt (lockedUntil).
 */
export async function recordLoginFailure(
  ip: string | null,
  identifier: string,
  type: "LOGIN" | "TWO_FA"
): Promise<void> {
  const ipNorm = ip ? normalizeIp(ip) : null;
  const idNorm = normalizeIdentifier(identifier);
  if (!idNorm || idNorm === "unknown") return;

  const typeEnum =
    type === "TWO_FA"
      ? AuthFailureTypeEnum.TWO_FA
      : AuthFailureTypeEnum.LOGIN;

  await prisma.loginFailure.create({
    data: {
      ipAddress: ipNorm ?? "0.0.0.0",
      identifier: idNorm,
      type: typeEnum,
    },
  });

  const sinceDate = since();
  const recentCount = await prisma.loginFailure.count({
    where: { identifier: idNorm, createdAt: { gte: sinceDate } },
  });

  if (recentCount >= LOCK_ACCOUNT_AFTER_FAILURES) {
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    if (idNorm.startsWith("user:")) {
      const userId = parseInt(idNorm.slice(5), 10);
      if (Number.isFinite(userId)) {
        await prisma.user.update({
          where: { id: userId },
          data: { lockedUntil },
        });
      }
    } else {
      await prisma.user.updateMany({
        where: { email: idNorm },
        data: { lockedUntil },
      });
    }
  }
}

/**
 * Prüft, ob der User wegen temporärer Sperre (lockedUntil) blockiert ist.
 */
export function isUserLockedUntil(user: {
  locked?: boolean;
  lockedUntil?: Date | null;
}): boolean {
  if (user.locked) return true;
  const until = user.lockedUntil;
  if (!until) return false;
  return new Date(until) > new Date();
}
