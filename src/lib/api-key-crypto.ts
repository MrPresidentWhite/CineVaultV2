/**
 * Verschlüsselung des Verifikationsschlüssels (öffentlicher SSH-Key) in der DB.
 * Nutzt dasselbe Secret-Setup wie das Passwort-Hashing (PASSWORD_PEPPER), kein Klartext in der DB.
 * AES-256-GCM nur für reversible Verschlüsselung (Argon2 ist einweg, Entschlüsselung nötig für Signaturprüfung).
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { PASSWORD_PEPPER, SESSION_SECRET } from "./env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = "v1.";

function getKey(): Buffer {
  const raw = PASSWORD_PEPPER || SESSION_SECRET || "dev-fallback-change-in-production";
  return createHash("sha256").update(raw, "utf8").digest();
}

/**
 * Verschlüsselt den öffentlichen Schlüssel (SSH-Format) für die Speicherung.
 * Rückgabe: "v1." + Base64(IV + Ciphertext + AuthTag)
 */
export function encryptVerificationKey(plaintext: string): string {
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

/**
 * Entschlüsselt den Verifikationsschlüssel.
 * Akzeptiert "v1." + Base64(...) (neu) oder Legacy-Klartext (ohne Präfix, nur für Migration).
 * In Produktion sollte nur verschlüsselter Inhalt vorkommen.
 */
export function decryptVerificationKey(ciphertext: string): string {
  if (!ciphertext?.trim()) return "";
  if (!ciphertext.startsWith(PREFIX)) {
    return ciphertext;
  }
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
