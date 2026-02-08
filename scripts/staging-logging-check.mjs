#!/usr/bin/env node
/**
 * Staging Logging-Check: Sucht in src/ nach riskanten console.*-Aufrufen,
 * die möglicherweise Passwörter, Tokens, Session-IDs oder API-Keys loggen könnten.
 * Schreibt Treffer nach logging-check.txt; Exit 1 wenn mindestens ein Treffer.
 * Security-Report v2 Abschnitt 15.3.
 *
 * Usage: node scripts/staging-logging-check.mjs [output.txt]
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, relative } from "path";

const SRC_DIR = "src";
const OUT_PATH = process.argv[2] || "logging-check.txt";

/** Variablennamen, die nicht geloggt werden dürfen (Wert könnte Secret sein). */
const SENSITIVE_NAMES = [
  "password",
  "token",
  "secret",
  "sessionId",
  "session_id",
  "apiKey",
  "api_key",
  "csrfToken",
  "csrf_token",
  "sid",
];

/**
 * Prüft eine Zeile: Enthält sie console.log/error/warn und eine riskante Variable?
 * - Template-Literal: `...${variable}...` wo variable in SENSITIVE_NAMES
 * - Oder: , variable) am Ende wo variable in SENSITIVE_NAMES (z. B. console.log("msg", password))
 */
function isRiskyLine(line) {
  const trimmed = line.trim();
  if (
    !trimmed.includes("console.log(") &&
    !trimmed.includes("console.error(") &&
    !trimmed.includes("console.warn(")
  ) {
    return false;
  }
  for (const name of SENSITIVE_NAMES) {
    const templateVar = new RegExp(
      `\\$\\{\\s*[^}]*\\b${name}\\b[^}]*\\}`,
      "i"
    );
    if (templateVar.test(trimmed)) return true;
    const argVar = new RegExp(
      `,\\s*[a-zA-Z_$][a-zA-Z0-9_$.]*\\b${name}\\b\\s*[\\)]`,
      "i"
    );
    if (argVar.test(trimmed)) return true;
  }
  return false;
}

function* walkTsFiles(dir, base = dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && !e.name.startsWith(".")) {
        yield* walkTsFiles(full, base);
      }
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      yield relative(base, full);
    }
  }
}

function run() {
  const hits = [];
  for (const file of walkTsFiles(SRC_DIR)) {
    const path = join(SRC_DIR, file);
    let content;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (isRiskyLine(lines[i])) {
        hits.push({ file, line: i + 1, content: lines[i].trim().slice(0, 120) });
      }
    }
  }

  const outLines = hits.length
    ? [
        `Logging-Check: ${hits.length} potenzielle Treffer (Security-Report v2 Abschnitt 15.3).`,
        "Keine Passwörter, Tokens, Session-IDs oder API-Keys in console.log/error/warn ausgeben.",
        "",
        ...hits.map((h) => `${h.file}:${h.line}: ${h.content}`),
      ]
    : ["Logging-Check: keine Treffer."];

  const out = outLines.join("\n");
  writeFileSync(OUT_PATH, out, "utf8");
  console.log(out);

  if (hits.length > 0) {
    process.exit(1);
  }
}

run();
