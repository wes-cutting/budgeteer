import type { Kysely } from "kysely";
import { cents, validateAllocations } from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../db/migrate";
import { NotFoundError, ValidationError } from "./errors";
import { assertEnvelopesUsable } from "./envelopeGuards";

export interface AllocationView {
  id: string;
  envelopeId: string;
  envelopeName: string;
  amountCents: number;
}

export interface TransactionView {
  id: string;
  accountId: string;
  accountName: string;
  kind: "opening" | "normal";
  amountCents: number; // signed
  occurredOn: string; // YYYY-MM-DD
  payee: string | null;
  memo: string | null;
  allocations: AllocationView[];
  allocatedCents: number;
  unallocatedCents: number;
}

/** Magnitudes are positive; the service applies sign from the transaction's direction. */
export interface CreateTransactionInput {
  direction: "deposit" | "withdrawal";
  magnitudeCents: number;
  occurredOn: string;
  payee: string | null;
  memo: string | null;
  allocations: AllocationInput[];
}
export interface AllocationInput {
  envelopeId: string;
  magnitudeCents: number;
}

interface TxnRow {
  id: string;
  account_id: string;
  amount_cents: string;
  kind: string;
  occurred_on: unknown;
  payee: string | null;
  memo: string | null;
  account_name: string;
}

const HH = DEFAULT_HOUSEHOLD_ID;
const todayStr = (): string => new Date().toISOString().slice(0, 10);
function toDateStr(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export function makeTransactionService(db: Kysely<DB>) {
  function selectTxns(exec: Kysely<DB>) {
    return exec
      .selectFrom("transactions as t")
      .innerJoin("accounts as a", "a.id", "t.account_id")
      .select([
        "t.id",
        "t.account_id",
        "t.amount_cents",
        "t.kind",
        "t.occurred_on",
        "t.payee",
        "t.memo",
        "a.name as account_name",
      ]);
  }

  async function attachViews(exec: Kysely<DB>, txns: TxnRow[]): Promise<TransactionView[]> {
    const ids = txns.map((t) => t.id);
    const allocRows = ids.length
      ? await exec
          .selectFrom("allocations as al")
          .innerJoin("envelopes as e", "e.id", "al.envelope_id")
          .select([
            "al.id",
            "al.transaction_id",
            "al.envelope_id",
            "e.name as envelope_name",
            "al.amount_cents",
          ])
          .where("al.transaction_id", "in", ids)
          .execute()
      : [];
    const byTxn = new Map<string, AllocationView[]>();
    for (const a of allocRows) {
      const list = byTxn.get(a.transaction_id) ?? [];
      list.push({
        id: a.id,
        envelopeId: a.envelope_id,
        envelopeName: a.envelope_name,
        amountCents: Number(a.amount_cents),
      });
      byTxn.set(a.transaction_id, list);
    }
    return txns.map((t) => {
      const allocations = byTxn.get(t.id) ?? [];
      const allocatedCents = allocations.reduce((s, a) => s + a.amountCents, 0);
      const amountCents = Number(t.amount_cents);
      return {
        id: t.id,
        accountId: t.account_id,
        accountName: t.account_name,
        kind: t.kind === "opening" ? "opening" : "normal",
        amountCents,
        occurredOn: toDateStr(t.occurred_on),
        payee: t.payee,
        memo: t.memo,
        allocations,
        allocatedCents,
        unallocatedCents: amountCents - allocatedCents,
      };
    });
  }

  async function getView(exec: Kysely<DB>, id: string): Promise<TransactionView> {
    const row = await selectTxns(exec)
      .where("t.id", "=", id)
      .where("t.household_id", "=", HH)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("transaction");
    const [view] = await attachViews(exec, [row]);
    if (!view) throw new NotFoundError("transaction");
    return view;
  }

  return {
    async create(accountId: string, input: CreateTransactionInput): Promise<TransactionView> {
      const sign = input.direction === "deposit" ? 1 : -1;
      const amount = cents(input.magnitudeCents * sign);
      const signed = input.allocations.map((a) => ({
        envelopeId: a.envelopeId,
        amountCents: cents(a.magnitudeCents * sign),
      }));
      const id = await db.transaction().execute(async (trx) => {
        const account = await trx
          .selectFrom("accounts")
          .select("id")
          .where("id", "=", accountId)
          .where("household_id", "=", HH)
          .executeTakeFirst();
        if (!account) throw new NotFoundError("account");
        await assertEnvelopesUsable(
          trx,
          HH,
          signed.map((s) => s.envelopeId),
        );
        const check = validateAllocations(
          amount,
          signed.map((s) => ({ amountCents: s.amountCents })),
        );
        if (!check.ok) throw new ValidationError(check.reason);
        const txn = await trx
          .insertInto("transactions")
          .values({
            household_id: HH,
            account_id: accountId,
            amount_cents: amount,
            kind: "normal",
            occurred_on: input.occurredOn,
            payee: input.payee,
            memo: input.memo,
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        if (signed.length > 0) {
          await trx
            .insertInto("allocations")
            .values(
              signed.map((s) => ({
                transaction_id: txn.id,
                envelope_id: s.envelopeId,
                amount_cents: s.amountCents,
              })),
            )
            .execute();
        }
        return txn.id;
      });
      return getView(db, id);
    },

    async listByAccount(accountId: string): Promise<TransactionView[]> {
      const account = await db
        .selectFrom("accounts")
        .select("id")
        .where("id", "=", accountId)
        .where("household_id", "=", HH)
        .executeTakeFirst();
      if (!account) throw new NotFoundError("account");
      const rows = await selectTxns(db)
        .where("t.account_id", "=", accountId)
        .orderBy("t.occurred_on", "desc")
        .orderBy("t.created_at", "desc")
        .execute();
      return attachViews(db, rows);
    },

    async replaceAllocations(
      txnId: string,
      allocations: AllocationInput[],
    ): Promise<TransactionView> {
      return db.transaction().execute(async (trx) => {
        const txn = await trx
          .selectFrom("transactions")
          .select(["id", "amount_cents"])
          .where("id", "=", txnId)
          .where("household_id", "=", HH)
          .executeTakeFirst();
        if (!txn) throw new NotFoundError("transaction");
        const amount = cents(Number(txn.amount_cents));
        const sign = amount >= 0 ? 1 : -1;
        const signed = allocations.map((a) => ({
          envelopeId: a.envelopeId,
          amountCents: cents(a.magnitudeCents * sign),
        }));
        await assertEnvelopesUsable(
          trx,
          HH,
          signed.map((s) => s.envelopeId),
        );
        const check = validateAllocations(
          amount,
          signed.map((s) => ({ amountCents: s.amountCents })),
        );
        if (!check.ok) throw new ValidationError(check.reason);
        await trx.deleteFrom("allocations").where("transaction_id", "=", txnId).execute();
        if (signed.length > 0) {
          await trx
            .insertInto("allocations")
            .values(
              signed.map((s) => ({
                transaction_id: txnId,
                envelope_id: s.envelopeId,
                amount_cents: s.amountCents,
              })),
            )
            .execute();
        }
        return getView(trx, txnId);
      });
    },

    async needsAllocation(): Promise<TransactionView[]> {
      const rows = await selectTxns(db)
        .where("t.household_id", "=", HH)
        .orderBy("t.occurred_on", "desc")
        .execute();
      const views = await attachViews(db, rows);
      return views.filter((v) => v.unallocatedCents !== 0);
    },
  };
}
