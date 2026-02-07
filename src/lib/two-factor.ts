/**
 * 2FA: TOTP (30-Sekunden-Codes), Secret-Verschlüsselung, Backup-Codes.
 * Nutzt otplib für TOTP, AES-256-GCM für Secret in der DB (Präfix "2fa.").
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { authenticator } from "otplib";
import { SESSION_SECRET } from "./env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = "2fa.";
const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getKey(): Buffer {
  const raw = SESSION_SECRET || "dev-fallback-change-in-production";
  return createHash("sha256").update(raw, "utf8").digest();
}

/** Generiert einen neuen TOTP-Secret (Base32). */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** Erzeugt otpauth-URI für QR-Code (issuer + account = E-Mail). */
export function getTotpKeyUri(secret: string, email: string, issuer: string): string {
  return authenticator.keyuri(email, issuer, secret);
}

/** Prüft einen 6-stelligen TOTP-Code (mit Toleranz-Fenster). */
export function verifyTotpToken(token: string, secret: string): boolean {
  if (!token?.trim() || !secret?.trim()) return false;
  const cleaned = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    return authenticator.check(cleaned, secret);
  } catch {
    return false;
  }
}

/** Verschlüsselt TOTP-Secret für DB (Präfix "2fa."). */
export function encryptTotpSecret(plaintext: string): string {
  if (!plaintext?.trim()) return "";
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, enc, tag]).toString("base64url");
}

/** Entschlüsselt TOTP-Secret aus DB. */
export function decryptTotpSecret(ciphertext: string): string {
  if (!ciphertext?.trim()) return "";
  if (!ciphertext.startsWith(PREFIX)) return "";
  try {
    const raw = Buffer.from(ciphertext.slice(PREFIX.length), "base64url");
    if (raw.length < IV_LEN + TAG_LEN) return "";
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(raw.length - TAG_LEN);
    const enc = raw.subarray(IV_LEN, raw.length - TAG_LEN);
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString("utf8") + decipher.final("utf8");
  } catch {
    return "";
  }
}

/** Generiert Backup-Codes (z. B. 10 × 8 Zeichen). */
export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  const chars = BACKUP_CODE_CHARS;
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += chars[randomBytes(1)[0]! % chars.length];
    }
    codes.push(code);
  }
  return codes;
}

/** Hash eines Backup-Codes für Speicherung (SHA-256 hex). */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

/** Formatiert Backup-Code zur Anzeige (z. B. XXXX-XXXX). */
export function formatBackupCode(code: string): string {
  const c = code.replace(/\s/g, "").toUpperCase();
  if (c.length >= 8) return `${c.slice(0, 4)}-${c.slice(4, 8)}`;
  return c;
}

export { BACKUP_CODE_COUNT };

/** Cookie-Name für vertrauenswürdiges Gerät (2FA-Skip). */
export const TRUST_COOKIE_NAME = "cv.2fa.trust";

/** Cookie-Name für ausstehenden 2FA-Login (nach Passwort-Check). */
export const PENDING_2FA_COOKIE_NAME = "cv.2fa.pending";
const PENDING_2FA_MAX_AGE_SEC = 5 * 60; // 5 Min

export function createPending2FaPayload(userId: number): string {
  const payload = JSON.stringify({
    userId,
    exp: Date.now() + PENDING_2FA_MAX_AGE_SEC * 1000,
  });
  return encryptTotpSecret(payload);
}

export function parsePending2FaPayload(encrypted: string): { userId: number } | null {
  const dec = decryptTotpSecret(encrypted);
  if (!dec) return null;
  try {
    const data = JSON.parse(dec) as { userId: number; exp: number };
    if (typeof data.userId !== "number" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

export { PENDING_2FA_MAX_AGE_SEC };
