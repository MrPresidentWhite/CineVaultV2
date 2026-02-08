/**
 * Datenmigration: MySQL-Dump (cinevault.sql) in die PostgreSQL-Datenbank importieren.
 *
 * Voraussetzung: Schema ist bereits angelegt (npm run db:migrate oder db:push).
 *
 * Aufruf: npx tsx scripts/migrate-mysql-to-postgres.ts [pfad/zum/cinevault.sql] [--truncate]
 * --truncate: Vor dem Import alle Tabellen leeren (für erneuten Import)
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

const INSERT_ORDER = [
  "User",
  "Collection",
  "Label",
  "Series",
  "Season",
  "Episode",
  "Movie",
  "ApiKey",
  "AuthChallenge",
  "File",
  "MovieGenre",
  "SeriesGenre",
  "MediaLabel",
  "user_status_preferences",
  "MovieStatusChange",
  "Session",
  "UserLabelPreference",
] as const;

/** Reihenfolge zum Leeren (Kind-Tabellen zuerst wegen FK) */
const TRUNCATE_ORDER = [...INSERT_ORDER].reverse();

function extractInsertStatements(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const regex = /INSERT INTO `([^`]+)`\s*\(([^)]+)\)\s*VALUES\s/gi;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(content)) !== null) {
    const tableName = m[1];
    const columnsPart = m[2];
    const startValues = m.index + m[0].length;
    let depth = 0;
    let inString = false;
    let escape = false;
    let quoteChar = "";
    let i = startValues;
    while (i < content.length) {
      const c = content[i];
      if (escape) {
        escape = false;
        i++;
        continue;
      }
      if (inString) {
        if (c === "\\") {
          escape = true;
          i++;
          continue;
        }
        if (c === quoteChar) {
          inString = false;
          i++;
          continue;
        }
        i++;
        continue;
      }
      if (c === "'" || c === '"') {
        inString = true;
        quoteChar = c;
        i++;
        continue;
      }
      if (c === "(") {
        depth++;
        i++;
        continue;
      }
      if (c === ")") {
        depth--;
        if (depth === 0) {
          let j = i + 1;
          while (j < content.length && /[\s\n\r]/.test(content[j])) j++;
          if (j < content.length && content[j] === ";") {
            const fullInsert = content.slice(m.index, j + 1);
            const pgInsert = toPostgresInsert(fullInsert, tableName);
            map.set(tableName, pgInsert);
            regex.lastIndex = j + 1;
            break;
          }
        }
        i++;
        continue;
      }
      i++;
    }
  }
  return map;
}

function toPostgresInsert(mysqlInsert: string, tableName: string): string {
  let out = mysqlInsert
    .replace(/`([^`]+)`/g, '"$1"')
    .replace(/\\'/g, "''");
  if (tableName === "User") {
    out = out.replace(/, (0|1), (0|1), (0|1), '/g, (_: string, a: string, b: string, c: string) =>
      `, ${a === "1" ? "true" : "false"}, ${b === "1" ? "true" : "false"}, ${c === "1" ? "true" : "false"}, '`);
    out = out.replace(/, (0|1)\),\s*(\n\s*\()/g, (_: string, a: string, rest: string) => `, ${a === "1" ? "true" : "false"}),${rest}`);
    out = out.replace(/, (0|1)\)\s*;\s*$/, (_: string, a: string) => `, ${a === "1" ? "true" : "false"});`);
  }
  if (tableName === "Series") {
    out = out.replace(/, (\d{4}|NULL), (0|1), '/g, (_: string, num: string, b: string) => `, ${num}, ${b === "1" ? "true" : "false"}, '`);
  }
  if (tableName === "MovieStatusChange") {
    out = out.replace(/', (0|1), /g, (_: string, a: string) => `', ${a === "1" ? "true" : "false"}, `);
  }
  if (tableName === "Session") {
    out = out.replace(/NULL, (0|1), /g, (_: string, a: string) => `NULL, ${a === "1" ? "true" : "false"}, `);
    out = out.replace(/', (0|1), '(\d{4}-)/g, (_: string, a: string, rest: string) => `', ${a === "1" ? "true" : "false"}, '${rest}`);
  }
  return out;
}

function updateSequences(client: Client, tableNames: string[]): Promise<void> {
  const tablesWithSerial = [
    "User",
    "Collection",
    "Label",
    "Series",
    "Season",
    "Episode",
    "Movie",
    "File",
    "MovieStatusChange",
    "user_status_preferences",
    "UserLabelPreference",
    "MediaLabel",
  ];
  return (async () => {
    for (const table of tablesWithSerial) {
      try {
        const q = `SELECT setval(pg_get_serial_sequence('"${table.replace(/"/g, '""')}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table.replace(/"/g, '""')}"), 1), true)`;
        await client.query(q);
      } catch (e) {
        console.warn(`Sequence für ${table} übersprungen:`, (e as Error).message);
      }
    }
  })();
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const truncateFirst = process.argv.includes("--truncate");
  const sqlPath =
    args[0] ||
    resolve(process.cwd(), "cinevault.sql") ||
    resolve(process.cwd(), "../Downloads/cinevault.sql");

  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl && process.env.POSTGRES_HOST && process.env.POSTGRES_USER && process.env.POSTGRES_DB) {
    const enc = encodeURIComponent;
    const p = process.env;
    const db = p.POSTGRES_DB ?? "";
    dbUrl = `postgresql://${enc(p.POSTGRES_USER!)}:${p.POSTGRES_PASSWORD ? enc(p.POSTGRES_PASSWORD) : ""}@${p.POSTGRES_HOST}:${p.POSTGRES_PORT ?? "5432"}/${enc(db)}`;
  }
  if (!dbUrl) {
    console.error("DATABASE_URL oder POSTGRES_HOST/POSTGRES_USER/POSTGRES_DB fehlt in .env");
    process.exit(1);
  }

  let content: string;
  try {
    content = readFileSync(sqlPath, "utf-8");
  } catch (e) {
    console.error("SQL-Datei nicht gefunden:", sqlPath, (e as Error).message);
    process.exit(1);
  }

  const inserts = extractInsertStatements(content);
  console.log("Gefundene Tabellen mit Daten:", [...inserts.keys()].join(", "));

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await client.query("BEGIN");
    if (truncateFirst) {
      console.log("Tabellen werden geleert (--truncate)…");
      for (const table of TRUNCATE_ORDER) {
        await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
      }
      console.log("Tabellen geleert.\n");
    }
    for (const table of INSERT_ORDER) {
      const sql = inserts.get(table);
      if (!sql) continue;
      try {
        await client.query(sql);
        const rowMatch = sql.match(/VALUES\s*([\s\S]*)/);
        const rows = rowMatch ? (rowMatch[1].match(/\),\s*\(/g)?.length ?? 0) + 1 : 0;
        console.log(`  ✓ ${table}: ${rows} Zeilen`);
      } catch (e) {
        console.error(`  ✗ ${table}:`, (e as Error).message);
        throw e;
      }
    }
    await updateSequences(client, [...inserts.keys()]);
    await client.query("COMMIT");
    console.log("Migration abgeschlossen.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Migration fehlgeschlagen:", e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
