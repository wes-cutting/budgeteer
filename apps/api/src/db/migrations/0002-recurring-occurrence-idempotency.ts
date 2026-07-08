import { type Kysely, sql } from "kysely";

/**
 * 0002 — recurring-occurrence idempotency (EH14). At most one generated transaction per
 * (rule, occurrence date): concurrent `postDue` calls both read the cursor pre-commit, so the
 * cursor alone can't prevent a double post — the partial unique index makes it structural.
 * Partial on `recurring_id is not null`: manual transactions (recurring_id null) are unconstrained.
 *
 * If this fails with a duplicate-key error, the double-post race already happened in this store:
 * the error names the duplicated (recurring_id, occurred_on). Resolve those ledger rows by hand —
 * a migration never deletes financial data on its own.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create unique index transactions_recurring_occurrence_uniq
      on transactions (recurring_id, occurred_on)
      where recurring_id is not null
  `.execute(db);
}
