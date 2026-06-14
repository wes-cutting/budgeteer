import { loadConfig } from "./config";
import { createDb } from "./db/connection";
import { migrateToLatest } from "./db/migrate";
import { buildServer } from "./http/server";

const config = loadConfig();
const db = await createDb(config.DATABASE_URL);
await migrateToLatest(db);

const app = buildServer(db, { logger: true });
await app.listen({ port: config.PORT, host: "0.0.0.0" });
