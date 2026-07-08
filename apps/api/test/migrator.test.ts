import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type Kysely, sql } from "kysely";
import { createDb } from "../src/db/connection";
import { migrateToLatest } from "../src/db/migrate";
import { up as baselineUp } from "../src/db/migrations/0001-baseline";
import type { DB } from "../src/db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../src/constants";

let db: Kysely<DB>;
beforeEach(async () => {
  db = await createDb(); // no DATABASE_URL → fresh in-memory PGlite
});
afterEach(async () => {
  await db.destroy();
});

const executedMigrations = async (): Promise<string[]> => {
  const { rows } = await sql<{
    name: string;
  }>`select name from kysely_migration order by name`.execute(db);
  return rows.map((r) => r.name);
};

const indexExists = async (name: string): Promise<boolean> => {
  const { rows } = await sql`select 1 from pg_indexes where indexname = ${name}`.execute(db);
  return rows.length === 1;
};

/** The baseline migration is deliberately schema-agnostic (`Kysely<unknown>`); calling it
 *  directly (as the pre-migrator simulations below do) means viewing the typed db untyped. */
const untyped = (d: Kysely<DB>) => d as unknown as Kysely<unknown>;

describe("versioned migrator (EH9)", () => {
  test("a fresh store runs every migration once, in order, and seeds the default household", async () => {
    await migrateToLatest(db);
    expect(await executedMigrations()).toEqual([
      "0001-baseline",
      "0002-recurring-occurrence-idempotency",
    ]);
    expect(await indexExists("transactions_recurring_occurrence_uniq")).toBe(true);
    const households = await db.selectFrom("households").select("id").execute();
    expect(households).toEqual([{ id: DEFAULT_HOUSEHOLD_ID }]);
  });

  test("re-running is a no-op (nothing re-executes, nothing duplicates)", async () => {
    await migrateToLatest(db);
    await migrateToLatest(db);
    expect(await executedMigrations()).toHaveLength(2);
    const households = await db.selectFrom("households").select("id").execute();
    expect(households).toHaveLength(1);
  });

  test("a pre-migrator store adopts the migrator cleanly (baseline is idempotent)", async () => {
    // Simulate a store created by the old single-function migrate.ts: full schema, no
    // kysely_migration bookkeeping.
    await baselineUp(untyped(db));
    await migrateToLatest(db);
    expect(await executedMigrations()).toEqual([
      "0001-baseline",
      "0002-recurring-occurrence-idempotency",
    ]);
    expect(await indexExists("transactions_recurring_occurrence_uniq")).toBe(true);
  });

  test("the household row heals after a truncate without a pending migration (db:reset contract)", async () => {
    await migrateToLatest(db);
    await sql`delete from households where id = ${DEFAULT_HOUSEHOLD_ID}::uuid`.execute(db);
    await migrateToLatest(db);
    const households = await db.selectFrom("households").select("id").execute();
    expect(households).toEqual([{ id: DEFAULT_HOUSEHOLD_ID }]);
  });

  test("a failing migration throws loudly and names the migration (duplicate occurrences block 0002)", async () => {
    // A legacy store where the double-post race already happened: 0002's unique index cannot
    // build, startup must fail with the migration named — never silently run half-migrated.
    await baselineUp(untyped(db));
    await sql`insert into households (id, name) values (${DEFAULT_HOUSEHOLD_ID}::uuid, 'H')`.execute(
      db,
    );
    const account = await db
      .insertInto("accounts")
      .values({ household_id: DEFAULT_HOUSEHOLD_ID, name: "Checking", kind: "checking" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const rule = await db
      .insertInto("recurring_transactions")
      .values({
        household_id: DEFAULT_HOUSEHOLD_ID,
        account_id: account.id,
        direction: "withdrawal",
        amount_cents: 100,
        frequency: "monthly",
        anchor_on: "2026-01-01",
        next_occurrence_on: "2026-01-01",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const doublePosted = {
      household_id: DEFAULT_HOUSEHOLD_ID,
      account_id: account.id,
      amount_cents: -100,
      kind: "normal",
      occurred_on: "2026-01-01",
      recurring_id: rule.id,
    };
    await db.insertInto("transactions").values([doublePosted, doublePosted]).execute();

    await expect(migrateToLatest(db)).rejects.toThrow(
      /0002-recurring-occurrence-idempotency.*failed/,
    );
    // Postgres has transactional DDL, so Kysely runs the whole pending batch atomically:
    // nothing is recorded as executed — the store is exactly as it was before the attempt.
    expect(await executedMigrations()).toEqual([]);
  });
});
