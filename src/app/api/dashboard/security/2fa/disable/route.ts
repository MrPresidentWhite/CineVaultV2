import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { verifyPassword } from "@/lib/password";
import {
  decryptTotpSecret,
  verifyTotpToken,
  hashBackupCode,
} from "@/lib/two-factor";

/**
 * POST /api/dashboard/security/2fa/disable
 * Body: { password: string, code: string } (code = TOTP oder Backup-Code).
 * Deaktiviert 2FA. Erfordert eingeloggt + EDITOR.
 */
export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { password: true, totpSecretEncrypted: true, totpEnabledAt: true },
  });

  if (!user?.totpEnabledAt) {
    return NextResponse.json(
      { ok: false, error: "2FA ist nicht aktiviert." },
      { status: 400 }
    );
  }

  let body: { password?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!password || !code) {
    return NextResponse.json(
      { ok: false, error: "Passwort und Code erforderlich." },
      { status: 400 }
    );
  }

  const validPassword = await verifyPassword(password, user.password);
  if (!validPassword) {
    return NextResponse.json(
      { ok: false, error: "Passwort ungültig." },
      { status: 400 }
    );
  }

  const codeClean = code.replace(/\s/g, "");
  let codeValid = false;

  if (/^\d{6}$/.test(codeClean)) {
    const secret = decryptTotpSecret(user.totpSecretEncrypted ?? "");
    codeValid = secret ? await verifyTotpToken(codeClean, secret) : false;
  } else {
    const hash = hashBackupCode(codeClean);
    const backup = await prisma.userBackupCode.findFirst({
      where: { userId: auth.user.id, codeHash: hash, usedAt: null },
    });
    if (backup) {
      codeValid = true;
      await prisma.userBackupCode.update({
        where: { id: backup.id },
        data: { usedAt: new Date() },
      });
    }
  }

  if (!codeValid) {
    return NextResponse.json(
      { ok: false, error: "Code ungültig oder bereits verwendet." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: auth.user.id },
      data: { totpSecretEncrypted: null, totpEnabledAt: null },
    }),
    prisma.userBackupCode.deleteMany({ where: { userId: auth.user.id } }),
    prisma.trustedDevice.deleteMany({ where: { userId: auth.user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
