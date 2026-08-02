/**
 * Development reset script — run via `npm run db:reset` from apps/api.
 *
 * PGlite (PGLITE_DIR set): deletes the data directory entirely — the fastest, cleanest reset.
 * **This takes the user accounts with it**, because they live in that directory; a PGlite store is
 * a throwaway dev store, so that is the intended trade. Re-create an admin afterwards (see below).
 *
 * PostgreSQL (DATABASE_URL set): empties the ledger via `truncateLedger`, which deliberately
 * **preserves `households`, `users` and `sessions`** — this is the production recovery path, and a
 * reset that logs the household out of its own data is a trap, not a feature (BUD-S90).
 *
 * In both cases the schema and household row are restored on the next `npm run seed`
 * (migrateToLatest is idempotent; it re-inserts the household on conflict-do-nothing).
 *
 * Exits with an error if no persistent store is configured (nothing to reset).
 */

import path from "node:path";
import fs from "node:fs";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config.js";
import { createDb } from "./connection.js";
import { truncateLedger } from "./resetLedger.js";

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
  console.log("User accounts went with it — this store has no way in until one is created.");
} else {
  const db = await createDb(cfg.DATABASE_URL);
  await truncateLedger(db);
  await db.destroy();
  console.log("Ledger emptied. User accounts and the household were preserved.");
}

console.log("Run `npm run seed` (or `npm run db:fresh`) to re-populate.");
