/**
 * Cloudflare Cache Purge.
 * Nutzt CLOUDFLARE_API_TOKEN und CLOUDFLARE_ZONE_ID aus der Umgebung.
 */

import { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID } from "./env";

/**
 * Purged eine Datei aus dem Cloudflare-Cache (z. B. nach R2-Upload).
 * @param fileUrl Vollständige öffentliche URL, z. B. https://cdn.cinevault.aw96.de/uploads/users/avatars/1.png
 * @returns true bei Erfolg, false wenn Purge übersprungen oder fehlgeschlagen
 */
export async function purgeCloudflareCache(fileUrl: string): Promise<boolean> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Cloudflare Purge] API Token oder Zone ID fehlt – Purge übersprungen"
      );
    }
    return false;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files: [fileUrl] }),
      }
    );

    const data = (await response.json()) as {
      success: boolean;
      errors?: unknown[];
    };

    if (data.success) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[Cloudflare Purge] Erfolgreich: ${fileUrl}`);
      }
      return true;
    }
    console.error("[Cloudflare Purge] Fehler:", data.errors);
    return false;
  } catch (err) {
    console.error("[Cloudflare Purge] Exception:", err);
    return false;
  }
}
