import type { Kysely } from "kysely";
import { cents, transferLegs, validateTransfer } from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../db/migrate";
import { NotFoundError, ValidationError } from "./errors";

/** A leg of a transfer as the UI sees it (the signed transaction on one account). */
export interface TransferLegView {
  transactionId: string;
  accountId: string;
  accountName: string;
  amountCents: number; // signed: −magnitude on the source, +magnitude on the destination
}

export interface TransferView {
  id: string;
  occurredOn: string; // YYYY-MM-DD
  memo: string | null;
  amountCents: number; // positive magnitude moved
  from: TransferLegView;
  to: TransferLegView;
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  magnitudeCents: number; // positive magnitude
  occurredOn: string; // YYYY-MM-DD
  memo: string | null;
}

const HH = DEFAULT_HOUSEHOLD_ID;
const toDateStr = (v: unknown): string =>
  typeof v === "string"
    ? v.slice(0, 10)
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : String(v);

export function makeTransferService(db: Kysely<DB>) {
  async function getView(exec: Kysely<DB>, id: string): Promise<TransferView> {
    const transfer = await exec
      .selectFrom("transfers")
      .select(["id", "occurred_on", "memo"])
      .where("id", "=", id)
      .where("household_id", "=", HH)
      .executeTakeFirst();
    if (!transfer) throw new NotFoundError("transfer");
    const legs = await exec
      .selectFrom("transactions as t")
      .innerJoin("accounts as a", "a.id", "t.account_id")
      .select(["t.id", "t.account_id", "t.amount_cents", "a.name as account_name"])
      .where("t.transfer_id", "=", id)
      .execute();
    const out = legs.find((l) => Number(l.amount_cents) < 0);
    const into = legs.find((l) => Number(l.amount_cents) > 0);
    if (!out || !into) throw new NotFoundError("transfer");
    const leg = (r: typeof out): TransferLegView => ({
      transactionId: r.id,
      accountId: r.account_id,
      accountName: r.account_name,
      amountCents: Number(r.amount_cents),
    });
    return {
      id: transfer.id,
      occurredOn: toDateStr(transfer.occurred_on),
      memo: transfer.memo,
      amountCents: Number(into.amount_cents),
      from: leg(out),
      to: leg(into),
    };
  }

  return {
    /** Move money between two accounts as a double-entry transfer (ADR-0004), atomically. */
    async create(input: CreateTransferInput): Promise<TransferView> {
      const check = validateTransfer(input.fromAccountId, input.toAccountId, input.magnitudeCents);
      if (!check.ok) throw new ValidationError(check.reason);
      const magnitude = cents(input.magnitudeCents);

      const id = await db.transaction().execute(async (trx) => {
        const accounts = await trx
          .selectFrom("accounts")
          .select(["id", "archived_at"])
          .where("household_id", "=", HH)
          .where("id", "in", [input.fromAccountId, input.toAccountId])
          .execute();
        const byId = new Map(accounts.map((a) => [a.id, a]));
        for (const accountId of [input.fromAccountId, input.toAccountId]) {
          const row = byId.get(accountId);
          if (!row) throw new NotFoundError("account");
          if (row.archived_at !== null) throw new ValidationError("That account is archived.");
        }

        const transfer = await trx
          .insertInto("transfers")
          .values({ household_id: HH, occurred_on: input.occurredOn, memo: input.memo })
          .returning("id")
          .executeTakeFirstOrThrow();
        const legs = transferLegs(input.fromAccountId, input.toAccountId, magnitude);
        await trx
          .insertInto("transactions")
          .values(
            legs.map((l) => ({
              household_id: HH,
              account_id: l.accountId,
              amount_cents: l.amountCents,
              kind: "transfer" as const,
              occurred_on: input.occurredOn,
              payee: null,
              memo: input.memo,
              transfer_id: transfer.id,
            })),
          )
          .execute();
        return transfer.id;
      });
      return getView(db, id);
    },
  };
}
