import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { hasEffectiveRole } from "@/lib/auth";
import { Role as RoleEnum } from "@/generated/prisma/enums";
import { getSessionIdFromCookie, updateSession } from "@/lib/session";
import {
  generateTotpSecret,
  getTotpKeyUri,
  encryptTotpSecret,
} from "@/lib/two-factor";
import QRCode from "qrcode";

const TOTP_ISSUER = "CineVault";

/**
 * POST /api/dashboard/security/2fa/setup
 * Startet 2FA-Setup: generiert Secret, speichert verschlüsselt in Session, liefert QR-Data-URL + manuellen Key.
 * Erfordert eingeloggt + EDITOR. User darf noch keine 2FA aktiv haben.
 */
export async function POST() {
  const auth = await getAuth();
  if (!auth || !hasEffectiveRole(auth, RoleEnum.EDITOR)) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt" }, { status: 403 });
  }

  const user = auth.user;
  if (user.totpEnabledAt) {
    return NextResponse.json(
      { ok: false, error: "2FA ist bereits aktiviert." },
      { status: 400 }
    );
  }

  const sid = await getSessionIdFromCookie();
  if (!sid) {
    return NextResponse.json(
      { ok: false, error: "Keine Session" },
      { status: 401 }
    );
  }

  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  await updateSession(sid, {
    ...auth.session,
    pendingTotpSecret: encrypted,
  });

  const otpauthUri = getTotpKeyUri(secret, user.email, TOTP_ISSUER);
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, {
    width: 220,
    margin: 2,
  });

  return NextResponse.json({
    ok: true,
    qrDataUrl,
    manualKey: secret,
  });
}
