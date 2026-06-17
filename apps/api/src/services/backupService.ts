import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";

export interface BudgeteerBackup {
  version: 1;
  exportedAt: string;
  householdId: string;
  tables: {
    households: Record<string, unknown>[];
    accounts: Record<string, unknown>[];
    envelopes: Record<string, unknown>[];
    transfers: Record<string, unknown>[];
    envelope_transfers: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
    allocations: Record<string, unknown>[];
    templates: Record<string, unknown>[];
    template_lines: Record<string, unknown>[];
    recurring_transactions: Record<string, unknown>[];
    recurring_lines: Record<string, unknown>[];
    reconciliations: Record<string, unknown>[];
    envelope_targets: Record<string, unknown>[];
    credit_limits: Record<string, unknown>[];
    loan_principals: Record<string, unknown>[];
  };
}

// Columns that carry integer-cent values (BigInt in PG → string in Kysely reads). Converted to
// number so the snapshot is consistent with the rest of the codebase. Number() is exact up to
// ~2^53 cents ≈ $90T (EH6 / ADR-0003).
const CENTS_COLUMNS = new Set([
  "amount_cents",
  "statement_balance_cents",
  "derived_balance_cents",
  "monthly_target_cents",
  "credit_limit_cents",
  "original_principal_cents",
]);

function normRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    result[k] = CENTS_COLUMNS.has(k) && typeof v === "string" ? Number(v) : v;
  }
  return result;
}

function norm<T>(rows: T[]): Record<string, unknown>[] {
  return (rows as unknown as Record<string, unknown>[]).map(normRow);
}

export function makeBackupService(db: Kysely<DB>) {
  return {
    async snapshot(): Promise<BudgeteerBackup> {
      const hid = DEFAULT_HOUSEHOLD_ID;

      const [
        households,
        accounts,
        envelopes,
        transfers,
        envelopeTransfers,
        transactions,
        allocations,
        templates,
        templateLines,
        recurringTransactions,
        recurringLines,
        reconciliations,
        envelopeTargets,
        creditLimits,
        loanPrincipals,
      ] = await Promise.all([
        db.selectFrom("households").where("id", "=", hid).selectAll().execute(),
        db.selectFrom("accounts").where("household_id", "=", hid).selectAll().execute(),
        db.selectFrom("envelopes").where("household_id", "=", hid).selectAll().execute(),
        db.selectFrom("transfers").where("household_id", "=", hid).selectAll().execute(),
        db.selectFrom("envelope_transfers").where("household_id", "=", hid).selectAll().execute(),
        db.selectFrom("transactions").where("household_id", "=", hid).selectAll().execute(),
        // allocations has no household_id; scope via the parent transaction
        db
          .selectFrom("allocations as a")
          .innerJoin("transactions as t", "t.id", "a.transaction_id")
          .where("t.household_id", "=", hid)
          .selectAll("a")
          .execute(),
        db.selectFrom("templates").where("household_id", "=", hid).selectAll().execute(),
        // template_lines has no household_id; scope via the parent template
        db
          .selectFrom("template_lines as tl")
          .innerJoin("templates as t", "t.id", "tl.template_id")
          .where("t.household_id", "=", hid)
          .selectAll("tl")
          .execute(),
        db
          .selectFrom("recurring_transactions")
          .where("household_id", "=", hid)
          .selectAll()
          .execute(),
        // recurring_lines has no household_id; scope via the parent recurring rule
        db
          .selectFrom("recurring_lines as rl")
          .innerJoin("recurring_transactions as rt", "rt.id", "rl.recurring_id")
          .where("rt.household_id", "=", hid)
          .selectAll("rl")
          .execute(),
        db.selectFrom("reconciliations").where("household_id", "=", hid).selectAll().execute(),
        db.selectFrom("envelope_targets").where("household_id", "=", hid).selectAll().execute(),
        db.selectFrom("credit_limits").where("household_id", "=", hid).selectAll().execute(),
        db.selectFrom("loan_principals").where("household_id", "=", hid).selectAll().execute(),
      ]);

      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        householdId: hid,
        tables: {
          households: norm(households),
          accounts: norm(accounts),
          envelopes: norm(envelopes),
          transfers: norm(transfers),
          envelope_transfers: norm(envelopeTransfers),
          transactions: norm(transactions),
          allocations: norm(allocations),
          templates: norm(templates),
          template_lines: norm(templateLines),
          recurring_transactions: norm(recurringTransactions),
          recurring_lines: norm(recurringLines),
          reconciliations: norm(reconciliations),
          envelope_targets: norm(envelopeTargets),
          credit_limits: norm(creditLimits),
          loan_principals: norm(loanPrincipals),
        },
      };
    },
  };
}
