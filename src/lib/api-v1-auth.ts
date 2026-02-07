/**
 * API v1 Challenge-Response-Auth: Signaturverifikation mit gespeichertem Public Key.
 * Optional: Signaturerzeugung mit Private Key (für Try-it-out / multipart verify).
 */

import { parseKey, parsePrivateKey, parseSignature } from "sshpk";

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

/**
 * Signiert den Nonce mit einem privaten SSH-Key und liefert die Signatur im SSH-Format (Base64).
 * Für Try-it-out: multipart verify mit Key-Datei (Key wird nur zur Signatur genutzt, nicht gespeichert).
 * Unterstützt RSA und Ed25519 (PEM oder OpenSSH-Format). Optional: passphrase für verschlüsselte Keys.
 */
export function signChallengeWithPrivateKey(
  privateKeyContent: string,
  nonce: string,
  passphrase?: string
): string {
  const trimmed = privateKeyContent.trim();
  if (!trimmed || !nonce) throw new Error("Key und Nonce erforderlich");
  const options =
    passphrase !== undefined && passphrase !== ""
      ? { passphrase: passphrase }
      : undefined;
  const key = parsePrivateKey(trimmed, "auto", options);
  const type = key.type.toLowerCase();
  if (type !== "rsa" && type !== "ed25519")
    throw new Error("Nur RSA und Ed25519 werden unterstützt");
  const hashAlgo = type === "rsa" ? "sha256" : undefined;
  const signer = key.createSign(hashAlgo);
  signer.update(Buffer.from(nonce, "utf8"));
  const sig = signer.sign();
  return sig.toString("ssh");
}
