/**
 * SSH-Key-Parsing: Fingerprint und Label (RSA + ED25519).
 * Nutzt sshpk für öffentliche und private Keys.
 */

import { parseKey } from "sshpk";

const ALLOWED_TYPES = ["rsa", "ed25519"] as const;

export type SshKeyInfo = {
  type: "rsa" | "ed25519";
  fingerprint: string;
  label: string;
  /** Öffentlicher Schlüssel im SSH-Format für Signaturverifikation (z. B. Challenge-Response). */
  publicKeySsh: string;
};

export type SshKeyParseError =
  | "INVALID_FORMAT"
  | "UNSUPPORTED_TYPE"
  | "ENCRYPTED_KEY";

export type ParseSshKeyOptions = {
  /** Passphrase für verschlüsselte private Keys. */
  passphrase?: string;
};

/**
 * Parst SSH-Key-Text (öffentlich oder privat), prüft auf RSA/ED25519,
 * liefert Fingerprint (SHA256, hex mit Doppelpunkten) und Label (Comment).
 * Bei verschlüsselten privaten Keys: passphrase in options übergeben.
 */
export function parseSshKey(
  keyContent: string,
  options?: ParseSshKeyOptions
): SshKeyInfo | SshKeyParseError {
  const trimmed = keyContent.trim();
  if (!trimmed) return "INVALID_FORMAT";

  const parseOptions: { passphrase?: string } = {};
  if (options?.passphrase !== undefined && options.passphrase !== "")
    parseOptions.passphrase = options.passphrase;

  try {
    const key = parseKey(trimmed, "auto", parseOptions);
    const type = key.type.toLowerCase();
    const allowed = type === "rsa" || type === "ed25519" || type === "curve25519";
    if (!allowed) return "UNSUPPORTED_TYPE";

    const normalizedType: "rsa" | "ed25519" =
      type === "curve25519" ? "ed25519" : (type as "rsa" | "ed25519");
    const fp = key.fingerprint("sha256", "ssh").toString("hex");
    const comment =
      (key as { comment?: string }).comment ?? normalizedType.toUpperCase();
    const publicKeySsh = (key as { toString?: (f: string) => string }).toString?.("ssh") ?? "";

    return {
      type: normalizedType,
      fingerprint: fp,
      label: comment.trim() || normalizedType.toUpperCase(),
      publicKeySsh,
    };
  } catch (err) {
    if (err && typeof err === "object" && "name" in err) {
      if ((err as { name?: string }).name === "KeyEncryptedError") {
        return "ENCRYPTED_KEY";
      }
    }
    return "INVALID_FORMAT";
  }
}

/** Prüft, ob der eingegebene Text wie ein privater Key aussieht (PEM/OpenSSH). */
export function looksLikePrivateKey(keyContent: string): boolean {
  const t = keyContent.trim();
  return (
    t.includes("-----BEGIN ") &&
    (t.includes("OPENSSH PRIVATE KEY") ||
      t.includes("RSA PRIVATE KEY") ||
      t.includes("EC PRIVATE KEY"))
  );
}
