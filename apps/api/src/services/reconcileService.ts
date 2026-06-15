import type { Kysely } from "kysely";
import { reconciliationDelta } from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../db/migrate";
import { NotFoundError } from "./errors";

export interface ReconciliationView {
  id: string;
  accountId: string;
  statementBalanceCents: number; // the real bank balance the user entered
  derivedBalanceCents: number; // Budgeteer's balance at reconcile time (snapshot)
  differenceCents: number; // statement − derived
  matched: boolean;
  reconciledOn: string; // YYYY-MM-DD
}

export interface CreateReconciliationInput {
  statementBalanceCents: number; // signed; an account balance can be negative
  reconciledOn: string; // YYYY-MM-DD
}

const HH = DEFAULT_HOUSEHOLD_ID;
const toDateStr = (v: unknown): string =>
  typeof v === "string"
    ? v.slice(0, 10)
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : String(v);

function toView(r: {
  id: string;
  account_id: string;
  statement_balance_cents: string;
  derived_balance_cents: string;
  reconciled_on: unknown;
}): ReconciliationView {
  const statement = Number(r.statement_balance_cents);
  const derived = Number(r.derived_balance_cents);
  const { differenceCents, matched } = reconciliationDelta(derived, statement);
  return {
    id: r.id,
    accountId: r.account_id,
    statementBalanceCents: statement,
    derivedBalanceCents: derived,
    differenceCents,
    matched,
    reconciledOn: toDateStr(r.reconciled_on),
  };
}

export function makeReconcileService(db: Kysely<DB>) {
  async function assertAccount(exec: Kysely<DB>, accountId: string): Promise<void> {
    const account = await exec
      .selectFrom("accounts")
      .select("id")
      .where("id", "=", accountId)
      .where("household_id", "=", HH)
      .executeTakeFirst();
    if (!account) throw new NotFoundError("account");
  }

  return {
    /** Record a reconciliation: snapshot the derived balance and store it against the statement. */
    async create(accountId: string, input: CreateReconciliationInput): Promise<ReconciliationView> {
      const id = await db.transaction().execute(async (trx) => {
        await assertAccount(trx, accountId);
        const bal = await trx
          .selectFrom("v_account_balances")
          .select("balance_cents")
          .where("account_id", "=", accountId)
          .executeTakeFirst();
        const derived = Number(bal?.balance_cents ?? 0);
        const row = await trx
          .insertInto("reconciliations")
          .values({
            household_id: HH,
            account_id: accountId,
            statement_balance_cents: input.statementBalanceCents,
            derived_balance_cents: derived,
            reconciled_on: input.reconciledOn,
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        return row.id;
      });
      const row = await db
        .selectFrom("reconciliations")
        .select([
          "id",
          "account_id",
          "statement_balance_cents",
          "derived_balance_cents",
          "reconciled_on",
        ])
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
      return toView(row);
    },

    /** Reconciliation history for an account, newest first. */
    async listByAccount(accountId: string): Promise<ReconciliationView[]> {
      await assertAccount(db, accountId);
      const rows = await db
        .selectFrom("reconciliations")
        .select([
          "id",
          "account_id",
          "statement_balance_cents",
          "derived_balance_cents",
          "reconciled_on",
        ])
        .where("account_id", "=", accountId)
        .where("household_id", "=", HH)
        .orderBy("reconciled_on", "desc")
        .orderBy("created_at", "desc")
        .execute();
      return rows.map(toView);
    },
  };
}
