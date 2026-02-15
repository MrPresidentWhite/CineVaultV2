/**
 * SSH key parsing: fingerprint and label (RSA + ED25519).
 * Uses sshpk for public and private keys.
 */

import { parseKey } from "sshpk";

export type SshKeyInfo = {
  type: "rsa" | "ed25519";
  fingerprint: string;
  label: string;
  /** Public key in SSH format for signature verification (e.g. challenge-response). */
  publicKeySsh: string;
};

export type SshKeyParseError =
  | "INVALID_FORMAT"
  | "UNSUPPORTED_TYPE"
  | "ENCRYPTED_KEY";

export type ParseSshKeyOptions = {
  /** Passphrase for encrypted private keys. */
  passphrase?: string;
};

/**
 * Parse SSH key text (public or private), check for RSA/ED25519,
 * return fingerprint (SHA256, hex with colons) and label (comment).
 * For encrypted private keys: pass passphrase in options.
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

/** Check if input text looks like a private key (PEM/OpenSSH). */
export function looksLikePrivateKey(keyContent: string): boolean {
  const t = keyContent.trim();
  return (
    t.includes("-----BEGIN ") &&
    (t.includes("OPENSSH PRIVATE KEY") ||
      t.includes("RSA PRIVATE KEY") ||
      t.includes("EC PRIVATE KEY"))
  );
}
