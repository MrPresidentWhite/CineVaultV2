/**
 * Next.js Instrumentation – läuft einmal beim Start des Node-Servers.
 * Setzt Prozess-Zeitzone auf Europe/Berlin (unabhängig von Server-TZ).
 * Fügt Timestamps zu allen console-Ausgaben hinzu (Log-Dateien nachvollziehbar).
 * Registriert node-cron-Jobs nur in Production:
 * - Session-Cleanup täglich 3:00 Uhr
 * - Digest-View-Token-Cleanup (abgelaufene „Im Browser öffnen“-Links) täglich 3:05 Uhr
 * - Status-Digest (E-Mail + Discord) täglich 10:00 und 21:00 Uhr
 * - Status-Scheduled (VÖ: Demnächst → Auf Wunschliste) täglich 6:00 Uhr
 * - VB-Watchdog (Versandstatus-E-Mails lesen, UPLOADED→ARCHIVED, VB_WISHLIST→SHIPPING) täglich 18:15 Uhr
 * - CDN-Warmup alle N Minuten (wenn WARMUP_ENABLED=1)
 */

const APP_TZ = "Europe/Berlin";
process.env.TZ = APP_TZ;

function timestamp(): string {
  return new Date().toLocaleString("de-DE", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function patchConsoleWithTimestamps(): void {
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  for (const method of methods) {
    const orig = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      orig(`[${timestamp()}]`, ...args);
    };
  }
}

function isProduction(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const env = process.env.ENVIRONMENT?.toLowerCase();
  return env === "prod" || env === "production" || env === undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  patchConsoleWithTimestamps();
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

  cron.default.schedule(
    "5 3 * * *",
    async () => {
      try {
        const { cleanupExpiredDigestViewTokens } = await import("@/lib/digest-job");
        const deleted = await cleanupExpiredDigestViewTokens();
        if (deleted > 0) {
          console.log(`[cron] Digest-View-Token-Cleanup: ${deleted} abgelaufene Tokens gelöscht`);
        }
      } catch (e) {
        console.error("[cron] Digest-View-Token-Cleanup fehlgeschlagen:", e);
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

  const vbWatchdogConfigured =
    process.env.VB_WATCHDOG_IMAP_HOST &&
    process.env.VB_WATCHDOG_IMAP_USER &&
    process.env.VB_WATCHDOG_IMAP_PASS &&
    process.env.VB_WATCHDOG_SMTP_FROM_VB_MAIL;
  if (vbWatchdogConfigured) {
    cron.default.schedule(
      "15 18 * * *",
      async () => {
        try {
          const { runVbWatchdogJob } = await import("@/lib/vb-watchdog-job");
          const result = await runVbWatchdogJob();
          if (result.processed > 0 || result.archived > 0 || result.shipping > 0) {
            console.log(
              `[cron] VB-Watchdog: ${result.processed} Mails, ${result.archived}→Archiviert, ${result.shipping}→Im Versand`
            );
          }
          if (result.errors.length > 0) {
            console.warn("[cron] VB-Watchdog Fehler:", result.errors);
          }
        } catch (e) {
          console.error("[cron] VB-Watchdog fehlgeschlagen:", e);
        }
      },
      opts
    );
  }

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
