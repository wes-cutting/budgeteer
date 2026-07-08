import { type Kysely, sql } from "kysely";
import { z } from "zod";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import type { DB } from "../db/schema";
import type { BudgeteerBackup } from "./backupService";
import { ConflictError, ValidationError } from "./errors";

/**
 * Restore a `BudgeteerBackup` file into an empty store (EH10 / roadmap #15b).
 * Design decisions from SPIKE-09 (docs/spikes/09-restore-roundtrip.md):
 *  - Non-destructive: refuses any store containing user data — never deletes rows.
 *  - The envelope is zod-validated here (the file is external input); row contents are
 *    validated by PostgreSQL itself (FK / check / not-null / unique constraints) inside one
 *    transaction, so a partial failure restores nothing.
 *  - Schema versioning: a file listing migrations the store lacks is from a newer app →
 *    refuse. A pre-stamping file (no `schema` field) restores with a warning.
 */

const rowSchema = z.record(z.string(), z.unknown());

const backupFileSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  householdId: z.string(),
  schema: z.object({ migrations: z.array(z.string()) }).optional(),
  tables: z.object({
    households: z.array(rowSchema),
    accounts: z.array(rowSchema),
    envelopes: z.array(rowSchema),
    transfers: z.array(rowSchema),
    envelope_transfers: z.array(rowSchema),
    transactions: z.array(rowSchema),
    allocations: z.array(rowSchema),
    templates: z.array(rowSchema),
    template_lines: z.array(rowSchema),
    recurring_transactions: z.array(rowSchema),
    recurring_lines: z.array(rowSchema),
    reconciliations: z.array(rowSchema),
    envelope_targets: z.array(rowSchema),
    credit_limits: z.array(rowSchema),
    loan_principals: z.array(rowSchema),
  }),
});

export type BudgeteerBackupFile = z.infer<typeof backupFileSchema>;

type TableName = keyof BudgeteerBackup["tables"];

/**
 * FK-safe insert order (SPIKE-09 F1) — parents strictly before children. NOT the file's key
 * order: there, `transactions` precedes the `recurring_transactions` it references. Every
 * table must appear exactly once; the export→restore→export equivalence test catches an
 * omission (the missing table's rows wouldn't survive the round-trip).
 */
const RESTORE_ORDER = [
  "households",
  "accounts",
  "envelopes",
  "transfers",
  "recurring_transactions",
  "templates",
  "transactions",
  "allocations",
  "template_lines",
  "recurring_lines",
  "envelope_transfers",
  "reconciliations",
  "envelope_targets",
  "credit_limits",
  "loan_principals",
] as const satisfies readonly TableName[];

/** Keep multi-VALUES statements well under PostgreSQL's 65 535 bind-parameter cap. */
const INSERT_CHUNK = 500;

/**
 * The one deliberately loose seam: rows come from the validated file with unknown values, and
 * PostgreSQL is their row-level validator (see module doc) — re-typing every column here would
 * duplicate the schema (EH1's two-sources-of-truth lesson). No `any`: the store is viewed as
 * generic string-keyed tables.
 */
type LooseDb = Kysely<Record<TableName, Record<string, unknown>>>;

export interface RestoreResult {
  /** Rows inserted per table (the household upsert counts as its 1 row). */
  tables: Record<TableName, number>;
  warnings: string[];
}

/** Validate the raw parsed JSON of a backup file; throws ValidationError with the zod detail. */
export function parseBackupFile(input: unknown): BudgeteerBackupFile {
  const result = backupFileSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ValidationError(`Not a valid Budgeteer backup file — ${issues}`);
  }
  return result.data;
}

export function makeRestoreService(db: Kysely<DB>) {
  const loose = db as unknown as LooseDb;

  return {
    async restore(backup: BudgeteerBackupFile): Promise<RestoreResult> {
      if (backup.householdId !== DEFAULT_HOUSEHOLD_ID) {
        throw new ValidationError(
          `Backup is for household ${backup.householdId}, not the default household this ` +
            `app manages (${DEFAULT_HOUSEHOLD_ID}) — cross-household import is not supported`,
        );
      }

      const warnings: string[] = [];
      const executed = (
        await sql<{ name: string }>`select name from kysely_migration`.execute(db)
      ).rows.map((r) => r.name);
      if (backup.schema) {
        const missing = backup.schema.migrations.filter((m) => !executed.includes(m));
        if (missing.length > 0) {
          throw new ConflictError(
            `Backup was exported from a newer schema — this store is missing migration(s) ` +
              `${missing.join(", ")}. Upgrade the app, then restore.`,
          );
        }
      } else {
        warnings.push(
          "Backup predates schema stamping (no schema.migrations field) — restoring without a schema check.",
        );
      }

      // Non-destructive: only a fresh store (nothing but the untouched seed household) is
      // accepted; merging into existing data is not restore.
      const occupied: string[] = [];
      await Promise.all(
        RESTORE_ORDER.map(async (table) => {
          const row =
            table === "households"
              ? await db
                  .selectFrom("households")
                  .select("id")
                  .where("id", "<>", DEFAULT_HOUSEHOLD_ID)
                  .limit(1)
                  .executeTakeFirst()
              : await loose
                  .selectFrom(table)
                  .select(sql`1`.as("one"))
                  .limit(1)
                  .executeTakeFirst();
          if (row !== undefined) occupied.push(table);
        }),
      );
      if (occupied.length > 0) {
        throw new ConflictError(
          `Store already contains data (${occupied.sort().join(", ")}) — restore never ` +
            `overwrites. Run \`npm run db:reset\` (or point PGLITE_DIR at a fresh directory), ` +
            `then retry.`,
        );
      }

      const counts = Object.fromEntries(RESTORE_ORDER.map((t) => [t, 0])) as Record<
        TableName,
        number
      >;
      await db.transaction().execute(async (trx) => {
        const looseTrx = trx as unknown as LooseDb;
        for (const table of RESTORE_ORDER) {
          const rows = backup.tables[table];
          if (rows.length === 0) continue;
          if (table === "households") {
            // Every migrated store already holds the seeded default-household row (SPIKE-09
            // F2) — overwrite it so the exported values (incl. created_at) win exactly.
            for (const row of rows) {
              await sql`
                insert into households (id, name, created_at)
                values (${row.id}::uuid, ${row.name}, ${row.created_at}::timestamptz)
                on conflict (id) do update
                  set name = excluded.name, created_at = excluded.created_at
              `.execute(trx);
            }
          } else {
            for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
              await looseTrx
                .insertInto(table)
                .values(rows.slice(i, i + INSERT_CHUNK))
                .execute();
            }
          }
          counts[table] = rows.length;
        }
      });

      return { tables: counts, warnings };
    },
  };
}
