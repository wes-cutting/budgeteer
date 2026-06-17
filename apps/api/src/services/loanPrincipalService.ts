import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import { NotFoundError, ValidationError } from "./errors";

const HH = DEFAULT_HOUSEHOLD_ID;

export interface LoanPrincipalView {
  accountId: string;
  originalPrincipalCents: number;
}

/**
 * The reference number for debt payoff (FEAT-014b): a per-loan-account original principal. A single
 * positive amount per account (no row = no principal), stored, mutable config — not a ledger row.
 * Writes only; the read (owed vs. original) lives in analysisService.debtPayoff.
 *
 * An original principal is only meaningful for an installment-loan account, so set is restricted to
 * kind='loan' (a principal on a checking/credit account is a category error → ValidationError → 400),
 * mirroring how a credit limit is restricted to kind='credit' (FEAT-014a).
 */
export function makeLoanPrincipalService(db: Kysely<DB>) {
  async function assertLoanAccount(trx: Kysely<DB>, accountId: string): Promise<void> {
    const account = await trx
      .selectFrom("accounts")
      .select(["id", "kind"])
      .where("id", "=", accountId)
      .where("household_id", "=", HH)
      .executeTakeFirst();
    if (!account) throw new NotFoundError("account");
    if (account.kind !== "loan") {
      throw new ValidationError("An original principal applies only to loan accounts.");
    }
  }

  return {
    /** Set (create or replace) a loan account's original principal (a positive magnitude). */
    async set(accountId: string, originalPrincipalCents: number): Promise<LoanPrincipalView> {
      return db.transaction().execute(async (trx) => {
        await assertLoanAccount(trx, accountId);
        const existing = await trx
          .selectFrom("loan_principals")
          .select("id")
          .where("account_id", "=", accountId)
          .executeTakeFirst();
        if (existing) {
          await trx
            .updateTable("loan_principals")
            .set({ original_principal_cents: originalPrincipalCents, updated_at: new Date() })
            .where("account_id", "=", accountId)
            .execute();
        } else {
          await trx
            .insertInto("loan_principals")
            .values({
              household_id: HH,
              account_id: accountId,
              original_principal_cents: originalPrincipalCents,
            })
            .execute();
        }
        return { accountId, originalPrincipalCents };
      });
    },

    /** Clear a loan account's original principal (idempotent — clearing an absent one is a no-op). */
    async clear(accountId: string): Promise<void> {
      await db.transaction().execute(async (trx) => {
        await assertLoanAccount(trx, accountId);
        await trx.deleteFrom("loan_principals").where("account_id", "=", accountId).execute();
      });
    },
  };
}
