/**
 * User-Agent parsen (Browser, OS, Gerätetyp).
 * Zuerst Erkennung eigener Apps (z. B. CineVault Mobile), danach „platform“ für Standard-Browser.
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

/** Custom User-Agents (App-Name, optional Version aus /x.y.z, OS/deviceType). */
const CUSTOM_UA_PATTERNS: Array<{
  test: (ua: string) => boolean;
  browser: (ua: string) => string;
  os?: string;
  deviceType: DeviceType;
}> = [
  {
    test: (ua) => /^CineVault-Mobile\//i.test(ua),
    browser: (ua) => {
      const match = ua.match(/^CineVault-Mobile\/([\d.]+)/i);
      const ver = match?.[1];
      return ver ? `CineVault Mobile ${ver}` : "CineVault Mobile";
    },
    os: "Mobile (Flutter)",
    deviceType: "mobile",
  },
];

function tryCustomUserAgent(ua: string): ParsedDevice | null {
  const trimmed = ua.trim();
  for (const { test, browser, os, deviceType } of CUSTOM_UA_PATTERNS) {
    if (test(trimmed)) {
      return {
        browser: browser(trimmed),
        os: os ?? "Unbekanntes OS",
        deviceType,
      };
    }
  }
  return null;
}

export function parseUserAgent(userAgent: string | null): ParsedDevice {
  const fallback: ParsedDevice = {
    browser: "Unbekannter Browser",
    os: "Unbekanntes OS",
    deviceType: "web",
  };

  if (!userAgent || !userAgent.trim()) return fallback;

  const custom = tryCustomUserAgent(userAgent);
  if (custom) return custom;

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
