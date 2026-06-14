import type { Kysely } from "kysely";
import { cents, validateEnvelopeTransfer } from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../db/migrate";
import { NotFoundError, ValidationError } from "./errors";

export interface EnvelopeTransferEndpointView {
  envelopeId: string;
  envelopeName: string;
}

export interface EnvelopeTransferView {
  id: string;
  occurredOn: string; // YYYY-MM-DD
  memo: string | null;
  amountCents: number; // positive magnitude moved
  from: EnvelopeTransferEndpointView;
  to: EnvelopeTransferEndpointView;
}

export interface CreateEnvelopeTransferInput {
  fromEnvelopeId: string;
  toEnvelopeId: string;
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

export function makeEnvelopeTransferService(db: Kysely<DB>) {
  async function getView(exec: Kysely<DB>, id: string): Promise<EnvelopeTransferView> {
    const row = await exec
      .selectFrom("envelope_transfers as et")
      .innerJoin("envelopes as ef", "ef.id", "et.from_envelope_id")
      .innerJoin("envelopes as eto", "eto.id", "et.to_envelope_id")
      .select([
        "et.id",
        "et.occurred_on",
        "et.memo",
        "et.amount_cents",
        "et.from_envelope_id",
        "ef.name as from_name",
        "et.to_envelope_id",
        "eto.name as to_name",
      ])
      .where("et.id", "=", id)
      .where("et.household_id", "=", HH)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("envelope transfer");
    return {
      id: row.id,
      occurredOn: toDateStr(row.occurred_on),
      memo: row.memo,
      amountCents: Number(row.amount_cents),
      from: { envelopeId: row.from_envelope_id, envelopeName: row.from_name },
      to: { envelopeId: row.to_envelope_id, envelopeName: row.to_name },
    };
  }

  return {
    /** Re-budget money between two envelopes (no account movement), atomically (ADR-0004 B). */
    async create(input: CreateEnvelopeTransferInput): Promise<EnvelopeTransferView> {
      const check = validateEnvelopeTransfer(
        input.fromEnvelopeId,
        input.toEnvelopeId,
        input.magnitudeCents,
      );
      if (!check.ok) throw new ValidationError(check.reason);
      const magnitude = cents(input.magnitudeCents);

      const id = await db.transaction().execute(async (trx) => {
        const rows = await trx
          .selectFrom("envelopes")
          .select(["id", "archived_at"])
          .where("household_id", "=", HH)
          .where("id", "in", [input.fromEnvelopeId, input.toEnvelopeId])
          .execute();
        const byId = new Map(rows.map((r) => [r.id, r]));
        const from = byId.get(input.fromEnvelopeId);
        const to = byId.get(input.toEnvelopeId);
        if (!from || !to) throw new NotFoundError("envelope");
        // Can't move money INTO an archived envelope; draining FROM one is allowed (ADR-0004).
        if (to.archived_at !== null) throw new ValidationError("That envelope is archived.");

        const created = await trx
          .insertInto("envelope_transfers")
          .values({
            household_id: HH,
            from_envelope_id: input.fromEnvelopeId,
            to_envelope_id: input.toEnvelopeId,
            amount_cents: magnitude,
            occurred_on: input.occurredOn,
            memo: input.memo,
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        return created.id;
      });
      return getView(db, id);
    },
  };
}
