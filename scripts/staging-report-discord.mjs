#!/usr/bin/env node
/**
 * Staging Report → Discord Webhook
 * Liest Lint-, Test-, Build- und Logging-Check-Ausgabe und sendet einen Embed an DISCORD_STAGING_WEBHOOK.
 * Env: LINT_OUTCOME, TEST_OUTCOME, BUILD_OUTCOME, LOGGING_CHECK_OUTCOME, DISCORD_STAGING_WEBHOOK
 * Usage: node scripts/staging-report-discord.mjs [lint.txt] [test.txt] [build.txt] [logging-check.txt]
 */

import { readFileSync, existsSync } from "fs";

const LINT_PATH = process.argv[2] || "lint.txt";
const TEST_PATH = process.argv[3] || "test.txt";
const BUILD_PATH = process.argv[4] || "build.txt";
const LOGGING_CHECK_PATH = process.argv[5] || "logging-check.txt";

function readTail(path, maxLines = 40) {
  if (!path || !existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const lines = raw.trim().split("\n");
    const tail = lines.slice(-maxLines).join("\n");
    return tail.length > 2000 ? tail.slice(-2000) : tail;
  } catch {
    return null;
  }
}

function outcomeLabel(outcome) {
  if (outcome === "success") return "✓ bestanden";
  if (outcome === "failure") return "✗ fehlgeschlagen";
  return outcome || "–";
}

/**
 * Parst Vitest-Ausgabe (stdout) und liefert { passed, failed, total, ok }.
 */
function parseTestOutput(content) {
  if (!content || typeof content !== "string") return null;
  const lines = content.trim().split("\n");
  let testsPassed = null;
  let testsFailed = null;
  let testFilesPassed = null;
  let testFilesFailed = null;
  for (const line of lines) {
    const filesMatch = line.match(/Test Files\s+(\d+)\s+passed\s+\((\d+)\)/i);
    if (filesMatch) testFilesPassed = parseInt(filesMatch[1], 10);
    const filesFailMatch = line.match(/Test Files\s+(\d+)\s+failed/i);
    if (filesFailMatch) testFilesFailed = parseInt(filesFailMatch[1], 10);
    const testsMatch = line.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/i);
    if (testsMatch) testsPassed = parseInt(testsMatch[1], 10);
    const testsFailMatch = line.match(/Tests\s+(\d+)\s+failed/i);
    if (testsFailMatch) testsFailed = parseInt(testsFailMatch[1], 10);
  }
  const passed = testsPassed ?? testFilesPassed ?? 0;
  const failed = testsFailed ?? testFilesFailed ?? 0;
  const total = passed + failed;
  const ok = failed === 0 && total > 0;
  return { passed, failed, total, ok };
}

function buildDiscordPayload(
  lintOutcome,
  testOutcome,
  buildOutcome,
  loggingCheckOutcome,
  testResult,
  loggingCheckContent
) {
  const loggingCheckPassed = loggingCheckOutcome === "success";
  const allPassed =
    lintOutcome === "success" &&
    testOutcome === "success" &&
    buildOutcome === "success" &&
    loggingCheckPassed;
  const color = allPassed ? 0x2ecc71 : 0xe74c3c; // grün : rot

  const fields = [
    { name: "Lint", value: outcomeLabel(lintOutcome), inline: true },
    { name: "Tests", value: outcomeLabel(testOutcome), inline: true },
    { name: "Build", value: outcomeLabel(buildOutcome), inline: true },
    { name: "Logging-Check", value: outcomeLabel(loggingCheckOutcome), inline: true },
  ];

  if (loggingCheckContent && !loggingCheckPassed) {
    const value =
      loggingCheckContent.length > 1024
        ? loggingCheckContent.slice(0, 1020) + "…"
        : loggingCheckContent;
    fields.push({ name: "Logging-Check (Details)", value, inline: false });
  }

  if (testResult && testResult.total > 0) {
    const testValue =
      testResult.ok
        ? `✓ ${testResult.passed} bestanden`
        : `✗ ${testResult.failed} fehlgeschlagen, ${testResult.passed} bestanden`;
    fields.push({ name: "Testergebnis", value: testValue, inline: false });
  }

  const repo = process.env.GITHUB_REPOSITORY ?? "CineVaultV2";
  const runId = process.env.GITHUB_RUN_ID ?? "";
  const runUrl = process.env.GITHUB_SERVER_URL
    ? `${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${runId}`
    : "";

  const embed = {
    title: "CineVaultV2 – Staging Report",
    description: allPassed
      ? "Lint, Tests, Build und Logging-Check erfolgreich. Deployment wird ausgelöst."
      : "Staging fehlgeschlagen. Kein Deployment.",
    color,
    fields,
    footer: {
      text: runUrl ? `Staging · ${repo} · Run #${runId}` : `Staging · ${repo}`,
    },
    timestamp: new Date().toISOString(),
  };

  if (runUrl) embed.url = runUrl;

  const payload = { embeds: [embed] };
  return payload;
}

async function sendDiscord(payload) {
  const webhook = process.env.DISCORD_STAGING_WEBHOOK?.trim();
  if (!webhook) {
    console.error("DISCORD_STAGING_WEBHOOK nicht gesetzt.");
    process.exit(1);
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Discord Webhook Fehler:", res.status, t.slice(0, 200));
    process.exit(1);
  }
  console.log("Staging-Report an Discord gesendet.");
}

function readFull(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const lintOutcome = process.env.LINT_OUTCOME ?? "";
  const testOutcome = process.env.TEST_OUTCOME ?? "";
  const buildOutcome = process.env.BUILD_OUTCOME ?? "";
  const loggingCheckOutcome = process.env.LOGGING_CHECK_OUTCOME ?? "";

  const lintTail = readTail(LINT_PATH);
  const testTail = readTail(TEST_PATH);
  const buildTail = readTail(BUILD_PATH);
  const loggingCheckContent = readFull(LOGGING_CHECK_PATH);

  const testResult = testTail ? parseTestOutput(testTail) : null;
  const payload = buildDiscordPayload(
    lintOutcome,
    testOutcome,
    buildOutcome,
    loggingCheckOutcome,
    testResult,
    loggingCheckContent
  );
  await sendDiscord(payload);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
