import type { Kysely } from "kysely";
import {
  type RecurringFrequency,
  anchorDayOf,
  cents,
  dueOccurrences,
  validateAllocations,
} from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import { todayStr, toDateStr } from "../util/dates";
import { groupBy } from "../util/groupBy";
import { NotFoundError, ValidationError } from "./errors";
import { assertEnvelopesUsable } from "./envelopeGuards";

export interface RecurringLineView {
  id: string;
  envelopeId: string;
  envelopeName: string;
  amountCents: number; // positive magnitude
  refund: boolean;
}

export interface RecurringView {
  id: string;
  accountId: string;
  accountName: string;
  direction: "deposit" | "withdrawal";
  amountCents: number; // positive magnitude
  payee: string | null;
  memo: string | null;
  frequency: RecurringFrequency;
  anchorOn: string; // YYYY-MM-DD
  nextOccurrenceOn: string; // YYYY-MM-DD
  dueCount: number; // occurrences on/before today not yet posted
  lines: RecurringLineView[];
}

export interface RecurringLineInput {
  envelopeId: string;
  magnitudeCents: number; // positive
  refund: boolean;
}

export interface CreateRecurringInput {
  accountId: string;
  direction: "deposit" | "withdrawal";
  magnitudeCents: number; // positive
  payee: string | null;
  memo: string | null;
  frequency: RecurringFrequency;
  anchorOn: string; // YYYY-MM-DD
  lines: RecurringLineInput[];
}

export interface PostDueResult {
  posted: number; // total transactions generated
  rules: { recurringId: string; posted: number; error?: string }[];
}

const HH = DEFAULT_HOUSEHOLD_ID;

/** Signed allocation amount: a normal line follows the direction; a refund line flips it. */
const signed = (mag: number, refund: boolean, dirSign: 1 | -1): number =>
  mag * (refund ? -dirSign : dirSign);

export function makeRecurringService(db: Kysely<DB>) {
  async function linesByRule(
    exec: Kysely<DB>,
    ruleIds: string[],
  ): Promise<Map<string, RecurringLineView[]>> {
    if (ruleIds.length === 0) return new Map<string, RecurringLineView[]>();
    const rows = await exec
      .selectFrom("recurring_lines as rl")
      .innerJoin("envelopes as e", "e.id", "rl.envelope_id")
      .select([
        "rl.id",
        "rl.recurring_id",
        "rl.envelope_id",
        "e.name as envelope_name",
        "rl.amount_cents",
        "rl.refund",
      ])
      .where("rl.recurring_id", "in", ruleIds)
      .orderBy("rl.position")
      .execute();
    return groupBy(
      rows,
      (r) => r.recurring_id,
      (r): RecurringLineView => ({
        id: r.id,
        envelopeId: r.envelope_id,
        envelopeName: r.envelope_name,
        amountCents: Number(r.amount_cents),
        refund: Boolean(r.refund),
      }),
    );
  }

  function toView(
    r: {
      id: string;
      account_id: string;
      account_name: string;
      direction: string;
      amount_cents: string;
      payee: string | null;
      memo: string | null;
      frequency: string;
      anchor_on: unknown;
      next_occurrence_on: unknown;
    },
    lines: RecurringLineView[],
    today: string,
  ): RecurringView {
    const anchorOn = toDateStr(r.anchor_on);
    const nextOccurrenceOn = toDateStr(r.next_occurrence_on);
    const due = dueOccurrences(
      nextOccurrenceOn,
      today,
      r.frequency as RecurringFrequency,
      anchorDayOf(anchorOn),
    );
    return {
      id: r.id,
      accountId: r.account_id,
      accountName: r.account_name,
      direction: r.direction === "deposit" ? "deposit" : "withdrawal",
      amountCents: Number(r.amount_cents),
      payee: r.payee,
      memo: r.memo,
      frequency: r.frequency as RecurringFrequency,
      anchorOn,
      nextOccurrenceOn,
      dueCount: due.dates.length,
      lines,
    };
  }

  const selectRules = (exec: Kysely<DB>) =>
    exec
      .selectFrom("recurring_transactions as r")
      .innerJoin("accounts as a", "a.id", "r.account_id")
      .select([
        "r.id",
        "r.account_id",
        "a.name as account_name",
        "r.direction",
        "r.amount_cents",
        "r.payee",
        "r.memo",
        "r.frequency",
        "r.anchor_on",
        "r.next_occurrence_on",
      ]);

  /** Insert one generated transaction + its allocations inside an existing transaction. */
  async function insertOccurrence(
    trx: Kysely<DB>,
    rule: {
      id: string;
      account_id: string;
      direction: string;
      payee: string | null;
      memo: string | null;
    },
    amountCents: number,
    signedLines: { envelopeId: string; amountCents: number }[],
    occurredOn: string,
  ): Promise<void> {
    const txn = await trx
      .insertInto("transactions")
      .values({
        household_id: HH,
        account_id: rule.account_id,
        amount_cents: amountCents,
        kind: "normal",
        occurred_on: occurredOn,
        payee: rule.payee,
        memo: rule.memo,
        recurring_id: rule.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    if (signedLines.length > 0) {
      await trx
        .insertInto("allocations")
        .values(
          signedLines.map((s) => ({
            transaction_id: txn.id,
            envelope_id: s.envelopeId,
            amount_cents: s.amountCents,
          })),
        )
        .execute();
    }
  }

  return {
    async list(): Promise<RecurringView[]> {
      const today = todayStr();
      const rules = await selectRules(db)
        .where("r.household_id", "=", HH)
        .orderBy("r.created_at")
        .execute();
      const lines = await linesByRule(
        db,
        rules.map((r) => r.id),
      );
      return rules.map((r) => toView(r, lines.get(r.id) ?? [], today));
    },

    async create(input: CreateRecurringInput): Promise<RecurringView> {
      if (input.lines.length === 0) throw new ValidationError("Add at least one split line.");
      const dirSign = input.direction === "deposit" ? 1 : -1;
      const amount = cents(input.magnitudeCents * dirSign);
      const signedLines = input.lines.map((l) => ({
        envelopeId: l.envelopeId,
        amountCents: cents(signed(l.magnitudeCents, l.refund, dirSign)),
      }));

      const id = await db.transaction().execute(async (trx) => {
        const account = await trx
          .selectFrom("accounts")
          .select("id")
          .where("id", "=", input.accountId)
          .where("household_id", "=", HH)
          .executeTakeFirst();
        if (!account) throw new NotFoundError("account");
        await assertEnvelopesUsable(
          trx,
          HH,
          signedLines.map((s) => s.envelopeId),
        );
        const check = validateAllocations(
          amount,
          signedLines.map((s) => ({ amountCents: s.amountCents })),
        );
        if (!check.ok) throw new ValidationError(check.reason);

        const rule = await trx
          .insertInto("recurring_transactions")
          .values({
            household_id: HH,
            account_id: input.accountId,
            direction: input.direction,
            amount_cents: input.magnitudeCents,
            payee: input.payee,
            memo: input.memo,
            frequency: input.frequency,
            anchor_on: input.anchorOn,
            next_occurrence_on: input.anchorOn, // first occurrence = anchor
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        await trx
          .insertInto("recurring_lines")
          .values(
            input.lines.map((l, i) => ({
              recurring_id: rule.id,
              envelope_id: l.envelopeId,
              amount_cents: l.magnitudeCents,
              refund: l.refund,
              position: i,
            })),
          )
          .execute();
        return rule.id;
      });

      const today = todayStr();
      const row = await selectRules(db).where("r.id", "=", id).executeTakeFirstOrThrow();
      const lines = await linesByRule(db, [id]);
      return toView(row, lines.get(id) ?? [], today);
    },

    async remove(id: string): Promise<void> {
      const found = await db
        .selectFrom("recurring_transactions")
        .select("id")
        .where("id", "=", id)
        .where("household_id", "=", HH)
        .executeTakeFirst();
      if (!found) throw new NotFoundError("recurring");
      await db.deleteFrom("recurring_transactions").where("id", "=", id).execute();
    },

    /** Generate every due transaction up to today and advance each rule's cursor. Idempotent. */
    async postDue(): Promise<PostDueResult> {
      const today = todayStr();
      const rules = await selectRules(db).where("r.household_id", "=", HH).execute();
      const lines = await linesByRule(
        db,
        rules.map((r) => r.id),
      );
      const result: PostDueResult = { posted: 0, rules: [] };

      for (const r of rules) {
        const anchorOn = toDateStr(r.anchor_on);
        const cursor = toDateStr(r.next_occurrence_on);
        const due = dueOccurrences(
          cursor,
          today,
          r.frequency as RecurringFrequency,
          anchorDayOf(anchorOn),
        );
        if (due.dates.length === 0) continue;

        const dirSign = r.direction === "deposit" ? 1 : -1;
        const amount = Number(r.amount_cents) * dirSign;
        const signedLines = (lines.get(r.id) ?? []).map((l) => ({
          envelopeId: l.envelopeId,
          amountCents: signed(l.amountCents, l.refund, dirSign),
        }));

        try {
          await db.transaction().execute(async (trx) => {
            // Re-check usability defensively (an envelope may have been archived since creation).
            await assertEnvelopesUsable(
              trx,
              HH,
              signedLines.map((s) => s.envelopeId),
            );
            for (const date of due.dates) {
              await insertOccurrence(trx, r, amount, signedLines, date);
            }
            await trx
              .updateTable("recurring_transactions")
              .set({ next_occurrence_on: due.nextCursor })
              .where("id", "=", r.id)
              .execute();
          });
          result.posted += due.dates.length;
          result.rules.push({ recurringId: r.id, posted: due.dates.length });
        } catch (e) {
          result.rules.push({
            recurringId: r.id,
            posted: 0,
            error: e instanceof Error ? e.message : "Could not post this rule.",
          });
        }
      }
      return result;
    },
  };
}
