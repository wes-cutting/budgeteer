/**
 * disable-user (ADR-0009 §8) — disable an account out of band, revoking all their sessions (they're
 * logged out everywhere and can't sign back in). Re-enable via the admin UI. Username from the
 * environment or a positional arg:
 *
 *   DISABLE_USERNAME=wes npm run disable-user --workspace @budgeteer/api
 *   npm run disable-user --workspace @budgeteer/api -- <username>
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config.js";
import { createDb } from "../db/connection.js";
import { migrateToLatest } from "../db/migrate.js";
import { DEFAULT_HOUSEHOLD_ID } from "../constants.js";
import { makeAuthService } from "../services/authService.js";
import { systemClock } from "../util/dates.js";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../../.env") });
const cfg = loadConfig();
if (!cfg.DATABASE_URL && !cfg.PGLITE_DIR) {
  console.error("\ndisable-user requires a persistent store (DATABASE_URL or PGLITE_DIR).\n");
  process.exit(1);
}

const username = process.env.DISABLE_USERNAME ?? process.argv[2];
if (!username) {
  console.error(
    "\nUsage: DISABLE_USERNAME=<u> npm run disable-user --workspace @budgeteer/api\n" +
      "   or: npm run disable-user --workspace @budgeteer/api -- <username>\n",
  );
  process.exit(1);
}

const db = await createDb(cfg.DATABASE_URL, cfg.PGLITE_DIR);
try {
  await migrateToLatest(db);
  const auth = makeAuthService(db, systemClock);
  const id = await auth.userIdByUsername(username, DEFAULT_HOUSEHOLD_ID);
  if (!id) {
    console.error(`\nNo user "${username}".\n`);
    process.exit(1);
  }
  await auth.setDisabled(id, true, DEFAULT_HOUSEHOLD_ID);
  console.log(`Disabled "${username}"; their sessions were revoked.`);
} finally {
  await db.destroy();
}
