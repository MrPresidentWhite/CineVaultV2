/**
 * API v1 Challenge-Response-Auth: Signaturverifikation mit gespeichertem Public Key.
 */

import { parseKey, parseSignature } from "sshpk";

/**
 * Prüft, ob die Signatur (Base64, SSH-Format) zum Nonce und zum öffentlichen Schlüssel passt.
 * @param publicKeySsh Öffentlicher Schlüssel im SSH-Format (z. B. "ssh-rsa AAAA... comment")
 * @param nonce Der Challenge-Nonce (Klartext)
 * @param signatureBase64 Signatur im SSH-Format, Base64-kodiert
 */
export function verifyChallengeSignature(
  publicKeySsh: string,
  nonce: string,
  signatureBase64: string
): boolean {
  if (!publicKeySsh?.trim() || !nonce || !signatureBase64?.trim()) return false;
  try {
    const key = parseKey(publicKeySsh.trim(), "ssh");
    const type = key.type.toLowerCase();
    if (type !== "rsa" && type !== "ed25519" && type !== "curve25519")
      return false;
    const sigType = type === "curve25519" ? "ed25519" : type;
    const sig = parseSignature(signatureBase64.trim(), sigType, "ssh");
    const verifier = key.createVerify();
    verifier.update(Buffer.from(nonce, "utf8"));
    return verifier.verify(sig);
  } catch {
    return false;
  }
}
