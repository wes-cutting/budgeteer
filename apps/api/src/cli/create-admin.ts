/**
 * create-admin (ADR-0009 §8) — the out-of-band bootstrap for the first (or another) admin, with no
 * HTTP surface. Credentials come from the environment (kept out of shell history / the process list)
 * or, as a fallback, positional args.
 *
 *   ADMIN_USERNAME=wes ADMIN_PASSWORD='…' npm run create-admin --workspace @budgeteer/api
 *   npm run create-admin --workspace @budgeteer/api -- <username> <password>
 *
 * Requires a persistent store (DATABASE_URL or PGLITE_DIR) — the same guard as `seed`. The password
 * is hashed with scrypt (util/password.ts); it is never logged.
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config.js";
import { createDb } from "../db/connection.js";
import { migrateToLatest } from "../db/migrate.js";
import { DEFAULT_HOUSEHOLD_ID } from "../constants.js";
import { makeAuthService } from "../services/authService.js";
import { DuplicateNameError, ValidationError } from "../services/errors.js";
import { systemClock } from "../util/dates.js";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../../.env") });
const cfg = loadConfig();

if (!cfg.DATABASE_URL && !cfg.PGLITE_DIR) {
  console.error(
    "\ncreate-admin requires a persistent store.\n" +
      "Set PGLITE_DIR or DATABASE_URL in .env (see .env.example).\n",
  );
  process.exit(1);
}

const username = process.env.ADMIN_USERNAME ?? process.argv[2];
const password = process.env.ADMIN_PASSWORD ?? process.argv[3];
if (!username || !password) {
  console.error(
    "\nUsage: ADMIN_USERNAME=<u> ADMIN_PASSWORD=<p> npm run create-admin --workspace @budgeteer/api\n" +
      "   or: npm run create-admin --workspace @budgeteer/api -- <username> <password>\n",
  );
  process.exit(1);
}

const db = await createDb(cfg.DATABASE_URL, cfg.PGLITE_DIR);
try {
  await migrateToLatest(db);
  const auth = makeAuthService(db, systemClock);
  const user = await auth.createUser({
    username,
    password,
    role: "admin",
    householdId: DEFAULT_HOUSEHOLD_ID,
  });
  console.log(`Created admin "${user.username}" (${user.id}).`);
} catch (e) {
  if (e instanceof ValidationError || e instanceof DuplicateNameError) {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  }
  throw e;
} finally {
  await db.destroy();
}
