#!/usr/bin/env node
/**
 * Konvertiert public/assets/logo-big.svg zu public/assets/logo-big.png.
 * Für E-Mails (SVG wird von Gmail/Outlook blockiert).
 * Ausführen: node scripts/convert-logo-svg-to-png.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SVG_PATH = join(ROOT, "public", "assets", "logo-big.svg");
const PNG_PATH = join(ROOT, "public", "assets", "logo-big.png");

if (!existsSync(SVG_PATH)) {
  console.error("SVG nicht gefunden:", SVG_PATH);
  process.exit(1);
}

const svg = readFileSync(SVG_PATH);

sharp(svg)
  .png()
  .toFile(PNG_PATH)
  .then(() => console.log("PNG erstellt:", PNG_PATH))
  .catch((err) => {
    console.error("Konvertierung fehlgeschlagen:", err);
    process.exit(1);
  });
