# Datenmigration MySQL → PostgreSQL

Import eines MySQL-Dumps (alte CineVault-DB) in die neue PostgreSQL-Datenbank.

## Voraussetzungen

1. **PostgreSQL-Schema** ist angelegt:
   ```bash
   npm run db:migrate
   ```
   oder
   ```bash
   npm run db:push
   ```

2. **`DATABASE_URL`** in `.env` zeigt auf die leere PostgreSQL-Datenbank.

3. **MySQL-Dump** (z. B. `cinevault.sql`) liegt vor.

## Ablauf

**Erster Import** (leere DB):

```bash
npm run db:import-mysql -- "d:\Downloads\cinevault.sql"
```

**Erneuter Import** (DB bereits befüllt – Tabellen werden zuerst geleert):

```bash
npm run db:import-mysql -- "d:\Downloads\cinevault.sql" --truncate
```

Mit npx:

```bash
npx tsx scripts/migrate-mysql-to-postgres.ts "pfad/zum/cinevault.sql" [--truncate]
```

Das Skript:

- liest den MySQL-Dump,
- konvertiert `INSERT`-Statements (Backticks → Anführungszeichen, Booleans 0/1 → false/true),
- führt die INSERTs in **FK-sicherer Reihenfolge** aus,
- setzt die **Sequences** für SERIAL-Spalten.

## Hinweise

- Die Migration läuft in einer **Transaktion** (bei Fehler wird zurückgerollt).
- Tabellen ohne Daten im Dump werden übersprungen.
- Bei erneutem Import `--truncate` verwenden, damit die Tabellen vor dem Import geleert werden.
