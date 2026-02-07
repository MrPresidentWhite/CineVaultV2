/**
 * Next.js Instrumentation – läuft einmal beim Start des Node-Servers.
 * Setzt Prozess-Zeitzone auf Europe/Berlin (unabhängig von Server-TZ).
 * Registriert node-cron-Jobs nur in Production:
 * - Session-Cleanup täglich 3:00 Uhr
 * - Status-Digest (E-Mail + Discord) täglich 10:00 und 21:00 Uhr
 * - Status-Scheduled (VÖ: Demnächst → Auf Wunschliste) täglich 6:00 Uhr
 * - CDN-Warmup alle N Minuten (wenn WARMUP_ENABLED=1)
 */

const APP_TZ = "Europe/Berlin";
process.env.TZ = APP_TZ;

function isProduction(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const env = process.env.ENVIRONMENT?.toLowerCase();
  return env === "prod" || env === "production" || env === undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!isProduction()) return;

  const cron = await import("node-cron");
  const opts = { timezone: APP_TZ };

  cron.default.schedule(
    "0 3 * * *",
    async () => {
      try {
        const { cleanupExpiredSessions } = await import("@/lib/session/store");
        const deleted = await cleanupExpiredSessions();
        console.log(`[cron] Session-Cleanup: ${deleted} abgelaufene Sessions gelöscht`);
      } catch (e) {
        console.error("[cron] Session-Cleanup fehlgeschlagen:", e);
      }
    },
    opts
  );

  const runDigest = async () => {
    try {
      const { sendStatusDigestJob } = await import("@/lib/digest-job");
      await sendStatusDigestJob();
    } catch (e) {
      console.error("[cron] Status-Digest fehlgeschlagen:", e);
    }
  };

  cron.default.schedule("0 10 * * *", runDigest, opts);
  cron.default.schedule("0 21 * * *", runDigest, opts);

  cron.default.schedule(
    "0 6 * * *",
    async () => {
      try {
        const { runStatusScheduledJob } = await import(
          "@/lib/status-scheduled-job"
        );
        const result = await runStatusScheduledJob();
        if (result.updated > 0) {
          console.log(
            `[cron] Status-Scheduled: ${result.updated} Filme auf Auf Wunschliste gesetzt`
          );
        }
      } catch (e) {
        console.error("[cron] Status-Scheduled fehlgeschlagen:", e);
      }
    },
    opts
  );

  const warmupEnabled = process.env.WARMUP_ENABLED === "1";
  const warmupMinutes = Math.max(
    1,
    parseInt(process.env.WARMUP_INTERVAL_MINUTES ?? "30", 10) || 30
  );
  if (warmupEnabled) {
    cron.default.schedule(
      `*/${warmupMinutes} * * * *`,
      async () => {
        try {
          const { runCdnWarmup } = await import("@/lib/cdn-warmup");
          const result = await runCdnWarmup();
          console.log(
            `[cron] CDN-Warmup: ${result.warmed} URLs (scope=${result.scope})`
          );
          if (result.errors.length > 0) {
            console.warn("[cron] CDN-Warmup Teilfehler:", result.errors);
          }
        } catch (e) {
          console.error("[cron] CDN-Warmup fehlgeschlagen:", e);
        }
      },
      opts
    );
  }
}
