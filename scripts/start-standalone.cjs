#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS-Script, require ist hier Standard */
/**
 * Wrapper für den Next.js Standalone-Server.
 * Lädt .env aus dem Projekt-Root, damit NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
 * und andere Variablen zur Laufzeit verfügbar sind (verhindert "Failed to find Server Action").
 */
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });

const standaloneDir = path.join(projectRoot, ".next", "standalone");
const server = spawn(process.execPath, ["server.js"], {
  cwd: standaloneDir,
  stdio: "inherit",
  env: process.env,
});

server.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
