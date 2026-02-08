#!/usr/bin/env node
/**
 * Security Report → Grok (AI summary) → Discord Webhook
 * Liest npm audit --json + optional Test-Ausgabe, Grok-Einschätzung, sendet Embed an Discord.
 * Env: GROK_API_URL, GROK_API_KEY, GROK_API_MODEL, DISCORD_SECURITY_WEBHOOK
 * Usage: node scripts/security-report-discord.mjs [audit.json] [test-output.txt]
 */

import { readFileSync, existsSync } from "fs";

const AUDIT_PATH = process.argv[2] || "audit.json";
const TEST_OUTPUT_PATH = process.argv[3] || null;

function readAudit(path) {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error("Audit-Datei nicht gefunden:", path);
      process.exit(1);
    }
    throw e;
  }
}

function parseAudit(audit) {
  const meta = audit.metadata?.vulnerabilities ?? {};
  const critical = meta.critical ?? 0;
  const high = meta.high ?? 0;
  const moderate = meta.moderate ?? 0;
  const low = meta.low ?? 0;
  const info = meta.info ?? 0;
  const total = critical + high + moderate + low + info;

  const vulnList = [];
  const vulns = audit.vulnerabilities ?? {};
  for (const [name, v] of Object.entries(vulns)) {
    const sev = v.severity ?? "unknown";
    const via = Array.isArray(v.via) ? v.via : v.via ? [v.via] : [];
    const ids = via
      .filter((x) => x && typeof x === "object" && x.url)
      .map((x) => x.url)
      .slice(0, 2);
    vulnList.push({ name, severity: sev, ids });
  }
  vulnList.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));

  return {
    critical,
    high,
    moderate,
    low,
    info,
    total,
    vulnList,
  };
}

function severityOrder(s) {
  const o = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };
  return o[s] ?? -1;
}

/**
 * Parst Vitest-Ausgabe (stdout) und liefert { passed, failed, total, ok }.
 */
function parseTestOutput(content) {
  if (!content || typeof content !== "string") return null;
  const lines = content.trim().split("\n");
  let testFilesPassed = null;
  let testFilesFailed = null;
  let testsPassed = null;
  let testsFailed = null;
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

function readTestOutput(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function buildSummaryText(parsed, testResult) {
  const { critical, high, moderate, low, info, vulnList } = parsed;
  const lines = [
    `npm audit Zusammenfassung: ${critical} critical, ${high} high, ${moderate} moderate, ${low} low, ${info} info.`,
  ];
  if (vulnList.length > 0) {
    lines.push(
      "Betroffene Pakete (max. 15): " +
        vulnList
          .slice(0, 15)
          .map((v) => `${v.name} (${v.severity})`)
          .join(", ")
    );
  }
  if (testResult) {
    if (testResult.ok) {
      lines.push(`Tests: ${testResult.passed} bestanden (${testResult.total} gesamt).`);
    } else if (testResult.total > 0) {
      lines.push(`Tests: ${testResult.failed} fehlgeschlagen, ${testResult.passed} bestanden (${testResult.total} gesamt).`);
    } else {
      lines.push("Tests: keine Ausgabe oder nicht ausgeführt.");
    }
  }
  return lines.join("\n");
}

async function callGrok(summaryText) {
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
          "Du bist ein Security-Assistent. Antworte nur auf Deutsch, kurz (2–4 Sätze). Keine generischen Ratschläge, nur konkrete Einschätzung.",
      },
      {
        role: "user",
        content: `Hier ist der Auszug eines Security-Reports (npm audit + ggf. Testergebnisse):\n\n${summaryText}\n\nWie kritisch ist die Lage insgesamt? Soll sofort etwas gemacht werden oder reicht zeitnah? Berücksichtige sowohl Schwachstellen als auch Testergebnisse. Nur sachliche Einschätzung in 2–4 Sätzen.`,
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

function discordColor(parsed) {
  if (parsed.critical > 0) return 0xcc0000; // rot
  if (parsed.high > 0) return 0xff8800; // orange
  if (parsed.moderate > 0 || parsed.low > 0) return 0xffcc00; // gelb
  return 0x2ecc71; // grün
}

function buildDiscordPayload(parsed, grokSummary, testResult) {
  const { critical, high, moderate, low, info, total, vulnList } = parsed;
  let color = discordColor(parsed);
  if (testResult && !testResult.ok && testResult.total > 0 && critical === 0) {
    color = 0xff8800; // orange bei Test-Fehlern (rot bleibt bei Critical)
  }

  const fields = [
    { name: "Critical", value: String(critical), inline: true },
    { name: "High", value: String(high), inline: true },
    { name: "Moderate", value: String(moderate), inline: true },
    { name: "Low", value: String(low), inline: true },
    { name: "Info", value: String(info), inline: true },
    { name: "Gesamt", value: String(total), inline: true },
  ];

  if (testResult !== undefined && testResult !== null) {
    const testValue =
      testResult.ok && testResult.total > 0
        ? `✓ ${testResult.passed} bestanden`
        : testResult.total > 0
          ? `✗ ${testResult.failed} fehlgeschlagen, ${testResult.passed} bestanden`
          : "– keine Ausgabe";
    fields.push({ name: "Tests", value: testValue, inline: false });
  }

  if (vulnList.length > 0) {
    const list = vulnList
      .slice(0, 12)
      .map((v) => `• ${v.name} (${v.severity})`)
      .join("\n");
    fields.push({
      name: "Betroffene Pakete",
      value: list.length > 1024 ? list.slice(0, 1020) + "…" : list,
      inline: false,
    });
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
    title: "CineVaultV2 – npm Security Report",
    description:
      total === 0
        ? "Keine bekannten Schwachstellen."
        : `${total} Schwachstelle(n) im Audit.`,
    color,
    fields,
    footer: {
      text: runUrl
        ? `Security Audit · ${repo} · Run #${runId}`
        : `Security Audit · ${repo}`,
    },
    timestamp: new Date().toISOString(),
  };

  if (runUrl) embed.url = runUrl;

  return { embeds: [embed] };
}

async function sendDiscord(payload) {
  const webhook = process.env.DISCORD_SECURITY_WEBHOOK?.trim();
  if (!webhook) {
    console.error("DISCORD_SECURITY_WEBHOOK nicht gesetzt.");
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
  console.log("Discord-Report gesendet.");
}

async function main() {
  const audit = readAudit(AUDIT_PATH);
  const parsed = parseAudit(audit);
  const testOutputRaw = readTestOutput(TEST_OUTPUT_PATH);
  const testResult = testOutputRaw ? parseTestOutput(testOutputRaw) : null;
  const summaryText = buildSummaryText(parsed, testResult);

  let grokSummary = null;
  grokSummary = await callGrok(summaryText);

  const payload = buildDiscordPayload(parsed, grokSummary, testResult);
  await sendDiscord(payload);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
