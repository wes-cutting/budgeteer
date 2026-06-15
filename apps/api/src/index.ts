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
const db = await createDb(config.DATABASE_URL);
await migrateToLatest(db);

const corsOrigins = config.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const app = buildServer(db, { logger: true, corsOrigins });
await app.listen({ port: config.PORT, host: "0.0.0.0" });
