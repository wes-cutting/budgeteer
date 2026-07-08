/**
 * Restore a backup file into the configured store — run from apps/api via
 * `npm run db:restore -- path/to/budgeteer-backup-YYYY-MM-DD.json` (EH10 / roadmap #15b).
 *
 * Non-destructive: refuses a store that already contains user data. The recovery flow is
 * `npm run db:reset` (or point PGLITE_DIR at a fresh directory), then restore. Decisions and
 * round-trip proof: docs/spikes/09-restore-roundtrip.md.
 *
 * The backup is the user's complete financial history — this script prints row COUNTS only,
 * never row contents.
 */

import path from "node:path";
import fs from "node:fs";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config.js";
import { createDb } from "./connection.js";
import { migrateToLatest } from "./migrate.js";
import { makeRestoreService, parseBackupFile } from "../services/restoreService.js";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../../.env") });

const cfg = loadConfig();

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("\nUsage: npm run db:restore -- path/to/budgeteer-backup-YYYY-MM-DD.json\n");
  process.exit(1);
}

if (!cfg.DATABASE_URL && !cfg.PGLITE_DIR) {
  console.error(
    "\nNo persistent store configured — nothing to restore into.\n" +
      "Set PGLITE_DIR or DATABASE_URL in .env (see .env.example).\n",
  );
  process.exit(1);
}

let raw: unknown;
try {
  raw = JSON.parse(fs.readFileSync(path.resolve(fileArg), "utf8"));
} catch (err) {
  console.error(`\nCould not read backup file: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
}

const db = await createDb(cfg.DATABASE_URL, cfg.PGLITE_DIR);
try {
  await migrateToLatest(db);
  const { tables, warnings } = await makeRestoreService(db).restore(parseBackupFile(raw));
  for (const w of warnings) console.warn(`! ${w}`);
  const total = Object.values(tables).reduce((sum, n) => sum + n, 0);
  console.log(`Restored ${total} rows:`);
  for (const [table, n] of Object.entries(tables)) {
    if (n > 0) console.log(`  ${table}: ${n}`);
  }
  console.log("Verify with `npm run dev` (or re-export and diff against the backup).");
} catch (err) {
  console.error(
    `\nRestore failed — nothing was written: ${err instanceof Error ? err.message : err}\n`,
  );
  process.exitCode = 1;
} finally {
  await db.destroy();
}
