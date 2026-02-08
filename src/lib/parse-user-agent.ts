/**
 * User-Agent parsen (Browser, OS, Gerätetyp).
 * Nutzt „platform“ wie im alten CineVault-Projekt.
 */

import type { DeviceType } from "./device";

// platform ist CJS: exportiert ein Objekt mit .parse(ua)
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS-only package
const platform = require("platform") as { parse: (ua?: string) => { name?: string; version?: string; os?: { family?: string }; product?: string } };

export type ParsedDevice = {
  browser: string;
  os: string;
  deviceType: DeviceType;
};

export function parseUserAgent(userAgent: string | null): ParsedDevice {
  const fallback: ParsedDevice = {
    browser: "Unbekannter Browser",
    os: "Unbekanntes OS",
    deviceType: "web",
  };

  if (!userAgent || !userAgent.trim()) return fallback;

  try {
    const info = platform.parse(userAgent) as {
      name?: string;
      version?: string;
      os?: { family?: string };
      product?: string;
    };

    let browser = fallback.browser;
    if (info.name) {
      const ver = info.version?.split(".")[0];
      browser = ver ? `${info.name} ${ver}`.trim() : info.name.trim();
    }

    const os = (info.os?.family ?? fallback.os).trim();

    let deviceType: DeviceType = "desktop";
    const osFamily = (info.os?.family ?? "").toLowerCase();
    const product = (info.product ?? "").toLowerCase();
    if (osFamily.includes("iphone") || osFamily.includes("android")) {
      deviceType = "mobile";
    } else if (osFamily.includes("ipad") || product.includes("tablet")) {
      deviceType = "mobile";
    }

    return { browser, os, deviceType };
  } catch {
    return fallback;
  }
}
