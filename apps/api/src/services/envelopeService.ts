import type { Kysely } from "kysely";
import { type EnvelopeKind, nameExists } from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../db/migrate";
import { DuplicateNameError, NotFoundError } from "./errors";

export interface EnvelopeView {
  id: string;
  name: string;
  kind: EnvelopeKind;
  balanceCents: number;
  archivedAt: string | null;
}

const toISO = (d: Date | string | null): string | null =>
  d == null ? null : d instanceof Date ? d.toISOString() : new Date(d).toISOString();

export function makeEnvelopeService(db: Kysely<DB>) {
  const selectView = (qb: Kysely<DB>) =>
    qb
      .selectFrom("envelopes as e")
      .leftJoin("v_envelope_balances as b", "b.envelope_id", "e.id")
      .select(["e.id", "e.name", "e.kind", "e.archived_at", "b.balance_cents"]);

  const toView = (r: {
    id: string;
    name: string;
    kind: string;
    archived_at: Date | null;
    balance_cents: string | null;
  }): EnvelopeView => ({
    id: r.id,
    name: r.name,
    kind: r.kind as EnvelopeKind,
    balanceCents: Number(r.balance_cents ?? 0),
    archivedAt: toISO(r.archived_at),
  });

  return {
    async list(): Promise<EnvelopeView[]> {
      const rows = await selectView(db)
        .where("e.household_id", "=", DEFAULT_HOUSEHOLD_ID)
        .orderBy("e.created_at")
        .execute();
      return rows.map(toView);
    },

    async create(input: { name: string; kind: EnvelopeKind }): Promise<EnvelopeView> {
      const id = await db.transaction().execute(async (trx) => {
        const names = await trx
          .selectFrom("envelopes")
          .select("name")
          .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
          .execute();
        if (
          nameExists(
            names.map((n) => n.name),
            input.name,
          )
        ) {
          throw new DuplicateNameError("An envelope with that name already exists.");
        }
        const envelope = await trx
          .insertInto("envelopes")
          .values({
            household_id: DEFAULT_HOUSEHOLD_ID,
            name: input.name,
            kind: input.kind,
            archived_at: null,
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        return envelope.id;
      });
      const row = await selectView(db).where("e.id", "=", id).executeTakeFirstOrThrow();
      return toView(row);
    },

    async rename(id: string, name: string): Promise<EnvelopeView> {
      return db.transaction().execute(async (trx) => {
        const current = await trx
          .selectFrom("envelopes")
          .select("id")
          .where("id", "=", id)
          .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
          .executeTakeFirst();
        if (!current) throw new NotFoundError("envelope");
        const others = await trx
          .selectFrom("envelopes")
          .select("name")
          .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
          .where("id", "<>", id)
          .execute();
        if (
          nameExists(
            others.map((n) => n.name),
            name,
          )
        ) {
          throw new DuplicateNameError("An envelope with that name already exists.");
        }
        await trx.updateTable("envelopes").set({ name }).where("id", "=", id).execute();
        const row = await selectView(trx).where("e.id", "=", id).executeTakeFirstOrThrow();
        return toView(row);
      });
    },

    /** Soft-delete (archive) or restore an envelope; history/balance is preserved either way. */
    async setArchived(id: string, archived: boolean): Promise<EnvelopeView> {
      const current = await db
        .selectFrom("envelopes")
        .select("id")
        .where("id", "=", id)
        .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
        .executeTakeFirst();
      if (!current) throw new NotFoundError("envelope");
      await db
        .updateTable("envelopes")
        .set({ archived_at: archived ? new Date() : null })
        .where("id", "=", id)
        .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
        .execute();
      const row = await selectView(db).where("e.id", "=", id).executeTakeFirstOrThrow();
      return toView(row);
    },
  };
}
