/**
 * Development reset script — run via `npm run db:reset` from apps/api.
 *
 * PGlite (PGLITE_DIR set): deletes the data directory entirely — the fastest, cleanest reset.
 * PostgreSQL (DATABASE_URL set): truncates all user tables; CASCADE handles FK order.
 *
 * In both cases the schema and household row are restored on the next `npm run seed`
 * (migrateToLatest is idempotent; it re-inserts the household on conflict-do-nothing).
 *
 * Exits with an error if no persistent store is configured (nothing to reset).
 */

import path from "node:path";
import fs from "node:fs";
import { sql } from "kysely";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config.js";
import { createDb } from "./connection.js";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../../.env") });

const cfg = loadConfig();

if (!cfg.DATABASE_URL && !cfg.PGLITE_DIR) {
  console.error(
    "\nNo persistent store configured — nothing to reset.\n" +
      "Set PGLITE_DIR or DATABASE_URL in .env (see .env.example).\n",
  );
  process.exit(1);
}

if (cfg.PGLITE_DIR) {
  fs.rmSync(cfg.PGLITE_DIR, { recursive: true, force: true });
  console.log(`Cleared PGlite store at ${cfg.PGLITE_DIR}`);
} else {
  const db = await createDb(cfg.DATABASE_URL);
  // Truncate leaf tables first, then parents; CASCADE covers any remaining FK order.
  await sql`
    TRUNCATE
      allocations, recurring_lines, template_lines,
      transactions, envelope_transfers, reconciliations,
      envelope_targets, credit_limits, loan_principals,
      transfers, recurring_transactions, templates,
      accounts, envelopes, households
    CASCADE
  `.execute(db);
  await db.destroy();
  console.log("All tables truncated.");
}

console.log("Run `npm run seed` (or `npm run db:fresh`) to re-populate.");
