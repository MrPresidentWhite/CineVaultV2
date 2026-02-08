import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getSession, getSessionIdFromCookie, updateSession } from "@/lib/session";
import {
  decryptTotpSecret,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
  BACKUP_CODE_COUNT,
} from "@/lib/two-factor";

type SessionWithPending = { pendingTotpSecret?: string };

/**
 * POST /api/dashboard/security/2fa/verify
 * Body: { code: string } (6-stelliger TOTP-Code).
 * Verifiziert Code gegen pendingTotpSecret aus Session, aktiviert 2FA, erzeugt Backup-Codes.
 * Erfordert eingeloggt + EDITOR. Liefert Backup-Codes einmalig.
 */
export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const sid = await getSessionIdFromCookie();
  if (!sid) {
    return NextResponse.json({ ok: false, error: "Keine Session" }, { status: 401 });
  }

  const session = await getSession();
  const pendingEncrypted = (session as SessionWithPending)?.pendingTotpSecret;
  if (!pendingEncrypted) {
    return NextResponse.json(
      { ok: false, error: "Kein 2FA-Setup gestartet. Bitte Setup erneut starten." },
      { status: 400 }
    );
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ ok: false, error: "Code fehlt" }, { status: 400 });
  }

  const secret = decryptTotpSecret(pendingEncrypted);
  if (!secret || !(await verifyTotpToken(code, secret))) {
    return NextResponse.json(
      { ok: false, error: "Ungültiger oder abgelaufener Code." },
      { status: 400 }
    );
  }

  const encryptedSecret = pendingEncrypted;
  const backupCodes = generateBackupCodes(BACKUP_CODE_COUNT);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: auth.user.id },
      data: {
        totpSecretEncrypted: encryptedSecret,
        totpEnabledAt: new Date(),
      },
    }),
    prisma.userBackupCode.createMany({
      data: backupCodes.map((code) => ({
        userId: auth.user.id,
        codeHash: hashBackupCode(code),
      })),
    }),
  ]);

  await updateSession(sid, {
    ...session!,
    pendingTotpSecret: undefined,
  });

  return NextResponse.json({
    ok: true,
    backupCodes,
  });
}
