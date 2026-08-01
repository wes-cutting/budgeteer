import path from "node:path";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "./config";
import { createDb } from "./db/connection";
import { migrateToLatest } from "./db/migrate";
import { buildServer } from "./http/server";

// Auto-load the repo-root .env (gitignored) so `cp .env.example .env` just works, regardless of
// the workspace cwd. Real process env vars take precedence (dotenv does not override existing).
loadEnv({ path: path.resolve(import.meta.dirname, "../../../.env") });

const config = loadConfig();
const db = await createDb(config.DATABASE_URL, config.PGLITE_DIR);
await migrateToLatest(db);

const corsOrigins = config.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const app = buildServer(db, {
  logger: { level: config.LOG_LEVEL },
  corsOrigins,
  // Auth is ALWAYS on for the real server (ADR-0009 · BUD-S87). SESSION_SECRET is required in
  // production (config enforces it); dev/e2e fall back to a fixed non-secret. `Secure` cookies only
  // in production (dev/e2e serve over plain HTTP on localhost).
  auth: {
    sessionSecret: config.SESSION_SECRET ?? "dev-only-insecure-session-secret-unset",
    secureCookie: config.APP_ENV === "production",
  },
});
await app.listen({ port: config.PORT, host: config.HOST });
