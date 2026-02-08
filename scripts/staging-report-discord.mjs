#!/usr/bin/env node
/**
 * Staging Report → Grok (KI-Einschätzung) → Discord Webhook
 * Liest Lint-, Test- und Build-Ausgabe, baut Kurzfassung, holt Grok-Einschätzung, sendet Embed an DISCORD_STAGING_WEBHOOK.
 * Env: LINT_OUTCOME, TEST_OUTCOME, BUILD_OUTCOME, LOGGING_CHECK_OUTCOME, DISCORD_STAGING_WEBHOOK, GROK_API_*
 * Usage: node scripts/staging-report-discord.mjs [lint.txt] [test.txt] [build.txt] [logging-check.txt] [staging-job-logs.txt]
 * Wenn das 5. Arg eine Log-Datei ist, wird sie als Anhang an Discord gesendet.
 */

import { readFileSync, existsSync } from "fs";

const LINT_PATH = process.argv[2] || "lint.txt";
const TEST_PATH = process.argv[3] || "test.txt";
const BUILD_PATH = process.argv[4] || "build.txt";
const LOGGING_CHECK_PATH = process.argv[5] || "logging-check.txt";
const JOB_LOGS_PATH = process.argv[6] || "";

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

function buildSummaryText(
  lintOutcome,
  testOutcome,
  buildOutcome,
  loggingCheckOutcome,
  lintTail,
  testTail,
  buildTail,
  loggingCheckContent
) {
  const lines = [
    `Lint: ${outcomeLabel(lintOutcome)}`,
    `Tests: ${outcomeLabel(testOutcome)}`,
    `Build: ${outcomeLabel(buildOutcome)}`,
    `Logging-Check: ${outcomeLabel(loggingCheckOutcome)}`,
  ];
  if (lintTail) lines.push("\n--- Lint (Auszug) ---\n" + lintTail);
  if (testTail) lines.push("\n--- Tests (Auszug) ---\n" + testTail);
  if (buildTail) lines.push("\n--- Build (Auszug) ---\n" + buildTail);
  if (loggingCheckContent) lines.push("\n--- Logging-Check ---\n" + loggingCheckContent);
  return lines.join("\n").slice(0, 6000);
}

async function callGrok(summaryText, allPassed) {
  const url = process.env.GROK_API_URL?.trim();
  const key = process.env.GROK_API_KEY?.trim();
  const model = process.env.GROK_API_MODEL?.trim();
  if (!url || !key || !model) return null;

  const chatUrl = url.includes("/chat/completions")
    ? url
    : url.replace(/\/?$/, "/v1/chat/completions");

  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "Du bist ein DevOps-/CI-Assistent. Antworte nur auf Deutsch, kurz (2–4 Sätze). Keine generischen Ratschläge, nur konkrete Einschätzung zum Staging-Ergebnis.",
      },
      {
        role: "user",
        content: allPassed
          ? `Staging-Check vor Deployment: Lint, Tests und Build sind alle erfolgreich durchgelaufen.\n\nKurze Einschätzung: Ist das Release bereit für Deployment? Nur 2–4 Sätze.`
          : `Staging-Check vor Deployment – mindestens ein Schritt ist fehlgeschlagen:\n\n${summaryText}\n\nWas ist das Problem und was sollte als Nächstes getan werden? Nur sachliche Einschätzung in 2–4 Sätzen.`,
      },
    ],
    max_tokens: 300,
  };

  try {
    const res = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("Grok API Fehler:", res.status, t.slice(0, 200));
      return null;
    }
    const data = await res.json();
    const content =
      data.choices?.[0]?.message?.content ??
      data.choices?.[0]?.text ??
      data.output?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  } catch (e) {
    console.error("Grok Request fehlgeschlagen:", e.message);
    return null;
  }
}

function buildDiscordPayload(
  lintOutcome,
  testOutcome,
  buildOutcome,
  loggingCheckOutcome,
  grokSummary,
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

  if (grokSummary && grokSummary.length > 0) {
    const text =
      grokSummary.length > 1024 ? grokSummary.slice(0, 1020) + "…" : grokSummary;
    fields.push({ name: "KI-Einschätzung (Grok)", value: text, inline: false });
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

  return { embeds: [embed] };
}

/** Discord-Dateilimit für Webhook-Anhang (8 MB, unter 25 MB Limit). */
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

async function sendDiscord(payload, logFilePath) {
  const webhook = process.env.DISCORD_STAGING_WEBHOOK?.trim();
  if (!webhook) {
    console.error("DISCORD_STAGING_WEBHOOK nicht gesetzt.");
    process.exit(1);
  }

  const hasAttachment = logFilePath && existsSync(logFilePath);
  let body;
  let headers = {};

  if (hasAttachment) {
    let logContent = readFileSync(logFilePath, "utf8");
    if (Buffer.byteLength(logContent, "utf8") > MAX_ATTACHMENT_BYTES) {
      const cut = "... [gekürzt, nur letzte 8 MB] ...\n\n";
      logContent = cut + logContent.slice(-(MAX_ATTACHMENT_BYTES - Buffer.byteLength(cut, "utf8")));
    }
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    form.append("file", new Blob([logContent], { type: "text/plain" }), "staging-job-logs.txt");
    body = form;
    // Content-Type mit Boundary setzt der Browser/Node bei FormData
  } else {
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Discord Webhook Fehler:", res.status, t.slice(0, 200));
    process.exit(1);
  }
  console.log("Staging-Report an Discord gesendet." + (hasAttachment ? " (Log-Datei angehängt)" : ""));
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
  const loggingCheckPassed = loggingCheckOutcome === "success";
  const allPassed =
    lintOutcome === "success" &&
    testOutcome === "success" &&
    buildOutcome === "success" &&
    loggingCheckPassed;
  const summaryText = buildSummaryText(
    lintOutcome,
    testOutcome,
    buildOutcome,
    loggingCheckOutcome,
    lintTail,
    testTail,
    buildTail,
    loggingCheckContent
  );

  let grokSummary = null;
  grokSummary = await callGrok(summaryText, allPassed);

  const payload = buildDiscordPayload(
    lintOutcome,
    testOutcome,
    buildOutcome,
    loggingCheckOutcome,
    grokSummary,
    testResult,
    loggingCheckContent
  );
  const attachLogs = !allPassed && (JOB_LOGS_PATH || "");
  await sendDiscord(payload, attachLogs || undefined);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
