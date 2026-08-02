import { type Kysely, sql } from "kysely";
import type { DB } from "./schema";

/**
 * Empty the ledger, leaving the household and its members intact (BUD-S90).
 *
 * Extracted from the `db:reset` CLI so the reset → restore round-trip can be pinned by a test:
 * the CLI is a top-level script with `process.exit` in it and cannot be imported.
 *
 * **`households`, `users` and `sessions` are deliberately NOT truncated.** `users.household_id`
 * references `households(id)` and `sessions.user_id` references `users(id) on delete cascade`, so
 * truncating the household with CASCADE took every account and session with it — and since
 * `/api/export` carries the ledger but no accounts, the documented reset-then-restore recovery
 * handed back a full ledger nobody could log into. Keeping the household row keeps the accounts.
 *
 * Restore is unaffected: `restoreService` upserts `households` `on conflict (id) do update` (so the
 * exported values still win exactly) and excludes the default household from its "store must be
 * empty" refusal check; `users` is not a backup table at all, so surviving accounts cannot block a
 * restore either.
 */
export async function truncateLedger(db: Kysely<DB>): Promise<void> {
  // Leaf tables first, then parents; CASCADE covers any remaining FK order.
  await sql`
    TRUNCATE
      allocations, recurring_lines, template_lines,
      transactions, envelope_transfers, reconciliations,
      envelope_targets, credit_limits, loan_principals,
      transfers, recurring_transactions, templates,
      accounts, envelopes
    CASCADE
  `.execute(db);
}
