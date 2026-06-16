import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import { NotFoundError } from "./errors";

const HH = DEFAULT_HOUSEHOLD_ID;

export interface EnvelopeTargetView {
  envelopeId: string;
  monthlyTargetCents: number;
}

/**
 * The "budget" side of budget-vs-actual (FEAT-012): per-envelope recurring monthly targets. A
 * single amount per envelope (no row = no target), stored, mutable config — not a ledger row.
 * Writes only; the read (target vs. actual spend) lives in analysisService.budgetVsActual.
 */
export function makeTargetService(db: Kysely<DB>) {
  async function assertEnvelope(trx: Kysely<DB>, envelopeId: string): Promise<void> {
    const env = await trx
      .selectFrom("envelopes")
      .select("id")
      .where("id", "=", envelopeId)
      .where("household_id", "=", HH)
      .executeTakeFirst();
    if (!env) throw new NotFoundError("envelope");
  }

  return {
    /** Set (create or replace) an envelope's monthly target. `monthlyTargetCents` is a positive magnitude. */
    async set(envelopeId: string, monthlyTargetCents: number): Promise<EnvelopeTargetView> {
      return db.transaction().execute(async (trx) => {
        await assertEnvelope(trx, envelopeId);
        const existing = await trx
          .selectFrom("envelope_targets")
          .select("id")
          .where("envelope_id", "=", envelopeId)
          .executeTakeFirst();
        if (existing) {
          await trx
            .updateTable("envelope_targets")
            .set({ monthly_target_cents: monthlyTargetCents, updated_at: new Date() })
            .where("envelope_id", "=", envelopeId)
            .execute();
        } else {
          await trx
            .insertInto("envelope_targets")
            .values({
              household_id: HH,
              envelope_id: envelopeId,
              monthly_target_cents: monthlyTargetCents,
            })
            .execute();
        }
        return { envelopeId, monthlyTargetCents };
      });
    },

    /** Clear an envelope's target (idempotent — clearing an absent target is a no-op). */
    async clear(envelopeId: string): Promise<void> {
      await db.transaction().execute(async (trx) => {
        await assertEnvelope(trx, envelopeId);
        await trx.deleteFrom("envelope_targets").where("envelope_id", "=", envelopeId).execute();
      });
    },
  };
}
