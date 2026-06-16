import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import { NotFoundError, ValidationError } from "./errors";

const HH = DEFAULT_HOUSEHOLD_ID;

export interface CreditLimitView {
  accountId: string;
  creditLimitCents: number;
}

/**
 * The reference number for credit utilization (FEAT-014a): a per-credit-account credit limit. A
 * single positive amount per account (no row = no limit), stored, mutable config — not a ledger
 * row. Writes only; the read (owed vs. limit) lives in analysisService.creditUtilization.
 *
 * A limit is only meaningful for a revolving-credit account, so set is restricted to kind='credit'
 * (a limit on a checking account is a category error → ValidationError → 400). Installment-loan
 * payoff (original principal) is the deferred sibling #14b.
 */
export function makeCreditLimitService(db: Kysely<DB>) {
  async function assertCreditAccount(trx: Kysely<DB>, accountId: string): Promise<void> {
    const account = await trx
      .selectFrom("accounts")
      .select(["id", "kind"])
      .where("id", "=", accountId)
      .where("household_id", "=", HH)
      .executeTakeFirst();
    if (!account) throw new NotFoundError("account");
    if (account.kind !== "credit") {
      throw new ValidationError("A credit limit applies only to credit accounts.");
    }
  }

  return {
    /** Set (create or replace) a credit account's limit. `creditLimitCents` is a positive magnitude. */
    async set(accountId: string, creditLimitCents: number): Promise<CreditLimitView> {
      return db.transaction().execute(async (trx) => {
        await assertCreditAccount(trx, accountId);
        const existing = await trx
          .selectFrom("credit_limits")
          .select("id")
          .where("account_id", "=", accountId)
          .executeTakeFirst();
        if (existing) {
          await trx
            .updateTable("credit_limits")
            .set({ credit_limit_cents: creditLimitCents, updated_at: new Date() })
            .where("account_id", "=", accountId)
            .execute();
        } else {
          await trx
            .insertInto("credit_limits")
            .values({
              household_id: HH,
              account_id: accountId,
              credit_limit_cents: creditLimitCents,
            })
            .execute();
        }
        return { accountId, creditLimitCents };
      });
    },

    /** Clear a credit account's limit (idempotent — clearing an absent limit is a no-op). */
    async clear(accountId: string): Promise<void> {
      await db.transaction().execute(async (trx) => {
        await assertCreditAccount(trx, accountId);
        await trx.deleteFrom("credit_limits").where("account_id", "=", accountId).execute();
      });
    },
  };
}
