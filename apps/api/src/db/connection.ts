import fs from "node:fs";
import { Kysely, PostgresDialect } from "kysely";
import type { DB } from "./schema";

/**
 * Create the Kysely instance (per ADR-0002). With a DATABASE_URL we use real PostgreSQL via
 * node-postgres; without one (dev/test) we use an in-process PGlite database — real Postgres
 * in WASM, no server needed — so the app runs and tests pass with zero infrastructure.
 */
export async function createDb(databaseUrl?: string, pgliteDir?: string): Promise<Kysely<DB>> {
  if (databaseUrl) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: databaseUrl });
    return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  }
  const { KyselyPGlite } = await import("kysely-pglite");
  if (pgliteDir) fs.mkdirSync(pgliteDir, { recursive: true });
  const pglite = await KyselyPGlite.create(pgliteDir ?? "memory://");
  return new Kysely<DB>({ dialect: pglite.dialect });
}
