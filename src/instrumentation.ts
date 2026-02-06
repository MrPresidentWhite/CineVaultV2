/**
 * Next.js Instrumentation – läuft einmal beim Start des Node-Servers.
 * Registriert hier z. B. node-cron-Jobs:
 * - Session-Cleanup täglich 3:00 Uhr
 * - Status-Digest (E-Mail + Discord) täglich 10:00 und 21:00 Uhr
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const cron = await import("node-cron");

  cron.default.schedule("0 3 * * *", async () => {
    try {
      const { cleanupExpiredSessions } = await import("@/lib/session/store");
      const deleted = await cleanupExpiredSessions();
      console.log(`[cron] Session-Cleanup: ${deleted} abgelaufene Sessions gelöscht`);
    } catch (e) {
      console.error("[cron] Session-Cleanup fehlgeschlagen:", e);
    }
  });

  const runDigest = async () => {
    try {
      const { sendStatusDigestJob } = await import("@/lib/digest-job");
      await sendStatusDigestJob();
    } catch (e) {
      console.error("[cron] Status-Digest fehlgeschlagen:", e);
    }
  };

  cron.default.schedule("0 10 * * *", runDigest);
  cron.default.schedule("0 21 * * *", runDigest);
}
