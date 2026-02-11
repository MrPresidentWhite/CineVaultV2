#!/usr/bin/env node
/**
 * Deploy-Report → Discord Webhook
 * Sendet eine einfache Embed-Nachricht bei Deployment-Erfolg oder -Fehler.
 * Nutzt denselben Webhook wie Staging (DISCORD_STAGING_WEBHOOK).
 * Env: DEPLOY_SUCCESS (true/false), GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SERVER_URL
 */

const success = process.env.DEPLOY_SUCCESS === "true";
const repo = process.env.GITHUB_REPOSITORY ?? "CineVaultV2";
const runId = process.env.GITHUB_RUN_ID ?? "";
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const runUrl = `${serverUrl}/${repo}/actions/runs/${runId}`;

const embed = {
  title: success ? "CineVaultV2 – Deploy erfolgreich" : "CineVaultV2 – Deploy fehlgeschlagen",
  description: success
    ? "Das Deployment wurde erfolgreich abgeschlossen. PM2 wurde neu gestartet."
    : "Das Deployment ist fehlgeschlagen. Bitte die Logs prüfen.",
  color: success ? 0x2ecc71 : 0xe74c3c,
  footer: {
    text: runUrl ? `Deploy · ${repo} · Run #${runId}` : `Deploy · ${repo}`,
  },
  timestamp: new Date().toISOString(),
};

if (runUrl) embed.url = runUrl;

async function main() {
  const webhook = process.env.DISCORD_STAGING_WEBHOOK?.trim();
  if (!webhook) {
    console.error("DISCORD_STAGING_WEBHOOK nicht gesetzt.");
    process.exit(1);
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Discord Webhook Fehler:", res.status, t.slice(0, 200));
    process.exit(1);
  }
  console.log(success ? "Deploy-Erfolg an Discord gesendet." : "Deploy-Fehler an Discord gesendet.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
