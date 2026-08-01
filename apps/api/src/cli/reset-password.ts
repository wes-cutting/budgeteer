/**
 * reset-password (ADR-0009 §8) — set a user's password out of band, revoking all their sessions
 * (they're logged out everywhere). Credentials from the environment or positional args:
 *
 *   RESET_USERNAME=wes RESET_PASSWORD='…' npm run reset-password --workspace @budgeteer/api
 *   npm run reset-password --workspace @budgeteer/api -- <username> <new-password>
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config.js";
import { createDb } from "../db/connection.js";
import { migrateToLatest } from "../db/migrate.js";
import { DEFAULT_HOUSEHOLD_ID } from "../constants.js";
import { makeAuthService } from "../services/authService.js";
import { ValidationError } from "../services/errors.js";
import { systemClock } from "../util/dates.js";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../../.env") });
const cfg = loadConfig();
if (!cfg.DATABASE_URL && !cfg.PGLITE_DIR) {
  console.error("\nreset-password requires a persistent store (DATABASE_URL or PGLITE_DIR).\n");
  process.exit(1);
}

const username = process.env.RESET_USERNAME ?? process.argv[2];
const password = process.env.RESET_PASSWORD ?? process.argv[3];
if (!username || !password) {
  console.error(
    "\nUsage: RESET_USERNAME=<u> RESET_PASSWORD=<p> npm run reset-password --workspace @budgeteer/api\n" +
      "   or: npm run reset-password --workspace @budgeteer/api -- <username> <new-password>\n",
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
  await auth.resetPassword(id, password, DEFAULT_HOUSEHOLD_ID);
  console.log(`Reset password for "${username}"; their sessions were revoked.`);
} catch (e) {
  if (e instanceof ValidationError) {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  }
  throw e;
} finally {
  await db.destroy();
}
