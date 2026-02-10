#!/usr/bin/env node
/**
 * Security Report → Grok (AI summary) → Discord Webhook
 * Liest npm audit --json + optional npm audit Text (audit.txt) + optional Test-Ausgabe,
 * parst Fix-Empfehlung (sicher vs --force/breaking), Grok-Einschätzung, sendet Embed an Discord.
 * Env: GROK_API_URL, GROK_API_KEY, GROK_API_MODEL, DISCORD_SECURITY_WEBHOOK
 * Usage: node scripts/security-report-discord.mjs [audit.json] [audit.txt] [test-output.txt]
 */

import { readFileSync, existsSync } from "fs";

// argv[2]=audit.json, argv[3]=audit.txt, argv[4]=test-output.txt; bei 2 Arg: argv[3]=test-output.txt
const a2 = process.argv[2];
const a3 = process.argv[3];
const a4 = process.argv[4];
const AUDIT_PATH = a2 || "audit.json";
const AUDIT_TXT_PATH = a4 ? a3 : null;
const TEST_OUTPUT_PATH = a4 || a3 || null;

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
    const firstVia = via.find((x) => x && typeof x === "object");
    const title = firstVia?.title ?? firstVia?.url ?? null;
    vulnList.push({ name, severity: sev, ids, title });
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
 * Parst die Text-Ausgabe von npm audit und erkennt, ob ein sicherer Fix möglich ist
 * oder ob npm audit fix --force (Breaking Change) nötig wäre.
 */
function parseAuditText(content) {
  if (!content || typeof content !== "string") return null;
  const text = content;
  const fixForceRequired =
    text.includes("npm audit fix --force") || text.includes("breaking change");
  const fixSafeAvailable = text.includes("fix available via `npm audit fix`");
  let recommendation;
  if (fixForceRequired && !fixSafeAvailable) {
    recommendation =
      "Teilweise nur mit npm audit fix --force (Breaking Change). Kann Projekt brechen – nicht blind ausführen.";
  } else if (fixForceRequired && fixSafeAvailable) {
    recommendation =
      "Sicherer Fix: npm audit fix. Zusätzlich werden Fixes mit --force angeboten (Breaking Change) – diese vermeiden.";
  } else if (fixSafeAvailable) {
    recommendation = "Sicherer Fix möglich: npm audit fix ausführen.";
  } else if (text.includes("vulnerabilities") && !fixSafeAvailable && !fixForceRequired) {
    recommendation = "Kein automatischer Fix angezeigt. Manuell prüfen oder Updates abwarten.";
  } else {
    recommendation = null;
  }
  return {
    fixSafeAvailable,
    fixForceRequired,
    recommendation,
  };
}

function readAuditText(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
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

function buildSummaryText(parsed, testResult, fixInfo) {
  const { critical, high, moderate, low, info, vulnList } = parsed;
  const lines = [
    `npm audit Zusammenfassung: ${critical} critical, ${high} high, ${moderate} moderate, ${low} low, ${info} info.`,
  ];
  if (fixInfo?.recommendation) {
    lines.push(`npm audit fix: ${fixInfo.recommendation}`);
  }
  if (vulnList.length > 0) {
    lines.push("");
    lines.push("Betroffene Pakete mit Kurzbeschreibung (für KI-Erklärung):");
    for (const v of vulnList.slice(0, 25)) {
      const desc = v.title ? ` – ${v.title}` : "";
      lines.push(`- ${v.name} (${v.severity})${desc}`);
    }
  }
  if (testResult) {
    lines.push("");
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
          "Du bist ein Security-Assistent. Antworte nur auf Deutsch. Gehe auf npm audit fix ein: Ob ein sicherer Fix (npm audit fix) reicht oder ob npm audit fix --force nötig wäre und das Projekt kaputt machen könnte. Liste die gefundenen vulnerablen Pakete auf und erkläre bei jedem (besonders bei high/critical), was das konkrete Problem ist (z.B. DoS, XSS, Prototype Pollution). Gib klare Handlungsempfehlungen.",
      },
      {
        role: "user",
        content: `Hier ist der Auszug eines Security-Reports (npm audit + Fix-Hinweis + ggf. Testergebnisse):\n\n${summaryText}\n\nBitte: (1) Einschätzung: Wie kritisch ist die Lage? Sofort handeln oder zeitnah? (2) npm audit fix: Soll „npm audit fix“ ausgeführt werden? Wenn „npm audit fix --force“ / Breaking Change erwähnt wird – würde das das Projekt kaputt machen, was empfiehlst du? (3) Liste die gefundenen vulnerablen Pakete auf und erkläre jeweils kurz, was das Problem ist (bei high/critical ausführlicher). Antworte in 6–12 Sätzen, sachlich und mit konkreten Empfehlungen.`,
      },
    ],
    max_tokens: 900,
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

function buildDiscordPayload(parsed, grokSummary, testResult, fixInfo) {
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

  if (fixInfo?.recommendation) {
    fields.push({
      name: "npm audit fix",
      value: fixInfo.recommendation.length > 1024 ? fixInfo.recommendation.slice(0, 1020) + "…" : fixInfo.recommendation,
      inline: false,
    });
  }

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

  // KI-Einschätzung als Nachricht (content), nicht im Embed – weniger Abschneiden, Discord-Markdown
  const MAX_CONTENT_LEN = 2000;
  const payload = { embeds: [embed] };
  if (grokSummary && grokSummary.length > 0) {
    const block = `**🔒 KI-Einschätzung (Grok)**\n\n${grokSummary}`;
    payload.content = block.length > MAX_CONTENT_LEN ? block.slice(0, MAX_CONTENT_LEN - 1) + "…" : block;
  }
  return payload;
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
  const auditTxtRaw = readAuditText(AUDIT_TXT_PATH);
  const fixInfo = auditTxtRaw ? parseAuditText(auditTxtRaw) : null;
  const testOutputRaw = readTestOutput(TEST_OUTPUT_PATH);
  const testResult = testOutputRaw ? parseTestOutput(testOutputRaw) : null;
  const summaryText = buildSummaryText(parsed, testResult, fixInfo);

  let grokSummary = null;
  grokSummary = await callGrok(summaryText);

  const payload = buildDiscordPayload(parsed, grokSummary, testResult, fixInfo);
  await sendDiscord(payload);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
