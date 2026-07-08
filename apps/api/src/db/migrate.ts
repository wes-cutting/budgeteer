import { type Kysely, type Migration, type MigrationProvider, Migrator, sql } from "kysely";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import type { DB } from "./schema";
import * as baseline from "./migrations/0001-baseline";
import * as recurringOccurrenceIdempotency from "./migrations/0002-recurring-occurrence-idempotency";

/**
 * The versioned migration registry (EH9). In-code (not FileMigrationProvider) so the registry is
 * typo-proof under both tsx and the test runner, and the ordering is visible right here: Kysely
 * executes keys in lexicographic order, so every new migration gets the next zero-padded prefix.
 * Migrations are FORWARD-ONLY (no `down`; ADR-0002's PGlite dev path makes throwaway stores cheap)
 * and FROZEN once committed — evolving the schema means adding a file, never editing one.
 * Executed names are recorded in `kysely_migration` (created/managed by Kysely).
 */
const migrations: Record<string, Migration> = {
  "0001-baseline": baseline,
  "0002-recurring-occurrence-idempotency": recurringOccurrenceIdempotency,
};

const provider: MigrationProvider = {
  getMigrations: () => Promise.resolve(migrations),
};

/**
 * Bring the store to the latest schema version, then ensure the seeded default household exists.
 * A migration failure throws (startup must fail loudly, not run on a half-migrated store).
 *
 * A store created before the migrator existed adopts it cleanly: 0001-baseline is the old
 * idempotent migration function frozen verbatim, so re-running it against the existing schema is
 * a no-op that records the baseline as executed.
 *
 * The household insert runs on every call (not inside a run-once migration) because `db:reset`'s
 * PostgreSQL path truncates `households` but not `kysely_migration` — the next startup/seed must
 * restore the row even though no migration is pending.
 */
export async function migrateToLatest(db: Kysely<DB>): Promise<void> {
  const migrator = new Migrator({ db, provider });
  const { error, results } = await migrator.migrateToLatest();
  if (error !== undefined) {
    const failed = results?.find((r) => r.status === "Error");
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      failed
        ? `Migration "${failed.migrationName}" failed: ${detail}`
        : `Migration failed: ${detail}`,
      { cause: error },
    );
  }

  await sql`
    insert into households (id, name)
    values (${DEFAULT_HOUSEHOLD_ID}::uuid, 'Default household')
    on conflict (id) do nothing
  `.execute(db);
}
