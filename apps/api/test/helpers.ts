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

/**
 * A fresh, isolated in-process PGlite database + migrated server per call. Pass `today`
 * ('YYYY-MM-DD') to pin the server's injected clock (EH7) — date-sensitive suites (recurring
 * due-ness, the register's default month window) MUST pin it and use absolute fixture dates;
 * relative-date fixtures against the real calendar are how the post-due case broke.
 */
export async function createTestApp(opts: { today?: string } = {}): Promise<TestApp> {
  const db = await createDb(); // no DATABASE_URL → in-memory PGlite
  await migrateToLatest(db);
  // Noon UTC keeps the fixed instant unambiguously inside the given calendar day.
  const app = buildServer(
    db,
    opts.today ? { clock: () => new Date(`${opts.today}T12:00:00Z`) } : {},
  );
  await app.ready();
  return { app, db };
}

/**
 * Like {@link createTestApp} but with authentication ENABLED (ADR-0009 · BUD-S87) — every route
 * except the public auth/health endpoints is default-deny. Used only by the auth suite; the rest of
 * the suites stay on the open `createTestApp` (they test business logic, not the gate).
 */
export async function createAuthTestApp(opts: { today?: string } = {}): Promise<TestApp> {
  const db = await createDb();
  await migrateToLatest(db);
  const app = buildServer(db, {
    auth: { sessionSecret: "test-only-session-secret-16+chars" },
    ...(opts.today ? { clock: () => new Date(`${opts.today}T12:00:00Z`) } : {}),
  });
  await app.ready();
  return { app, db };
}

export async function closeTestApp({ app, db }: TestApp): Promise<void> {
  await app.close();
  await db.destroy();
}
