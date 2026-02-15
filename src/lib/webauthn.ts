/**
 * WebAuthn/Passkey configuration for CineVault.
 * In Dev: rpID/origin aus Request (tatsächliche Browser-Origin).
 * In Prod: APP_URL oder WEBAUTHN_RP_ID.
 */

import { APP_URL, isDev } from "./env";
import { getPublicOrigin } from "./request-url";

function getEnv(key: string): string | undefined {
  return process.env[key];
}

/** Relying Party ID – hostname without port. WebAuthn requires exact match to origin. */
export function getWebAuthnRpId(request?: Request): string {
  if (isDev && request) {
    const origin = getPublicOrigin(request);
    try {
      return new URL(origin).hostname;
    } catch {
      return "localhost";
    }
  }
  const explicit = getEnv("WEBAUTHN_RP_ID");
  if (explicit?.trim()) return explicit.trim();
  try {
    const u = new URL(APP_URL);
    return u.hostname;
  } catch {
    return "localhost";
  }
}

/** Origin for WebAuthn – full URL without trailing slash. */
export function getWebAuthnOrigin(request?: Request): string {
  if (isDev && request) {
    return getPublicOrigin(request).replace(/\/+$/, "");
  }
  return APP_URL.replace(/\/+$/, "");
}

/** Human-readable RP name shown in authenticator prompts. */
export const WEBAUTHN_RP_NAME = "CineVault";

const TRANSPORT_LABELS: Record<string, string> = {
  internal: "Gerät (Touch ID / Face ID / Windows Hello)",
  usb: "USB-Sicherheitsschlüssel",
  nfc: "NFC",
  ble: "Bluetooth",
  hybrid: "Hybrid (QR-Code)",
  cable: "USB-Kabel",
  "smart-card": "Smartcard",
};

/**
 * Generates a display name for a passkey from deviceType and transports.
 * Used when the user doesn't provide a custom name during registration.
 */
export function generatePasskeyDisplayName(
  deviceType: string | null,
  transports: string[] | null
): string {
  const isMulti = deviceType === "multiDevice";
  const primary = transports?.[0];
  const label = primary ? TRANSPORT_LABELS[primary] : null;

  if (label) {
    return isMulti ? `Synchronisiert · ${label}` : label;
  }
  return isMulti ? "Synchronisierter Passkey" : "Sicherheitsschlüssel";
}
