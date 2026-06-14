import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { createDb } from "../src/db/connection";
import { migrateToLatest } from "../src/db/migrate";
import { buildServer } from "../src/http/server";
import type { DB } from "../src/db/schema";

export interface TestApp {
  app: FastifyInstance;
  db: Kysely<DB>;
}

/** A fresh, isolated in-process PGlite database + migrated server per call. */
export async function createTestApp(): Promise<TestApp> {
  const db = await createDb(); // no DATABASE_URL → in-memory PGlite
  await migrateToLatest(db);
  const app = buildServer(db);
  await app.ready();
  return { app, db };
}

export async function closeTestApp({ app, db }: TestApp): Promise<void> {
  await app.close();
  await db.destroy();
}
