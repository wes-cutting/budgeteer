import { type Kysely, sql } from "kysely";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import { groupBy } from "../util/groupBy";

export type SpendGrain = "month" | "year";

export interface EnvelopeSpendRow {
  envelopeId: string;
  envelopeName: string;
  archived: boolean;
  /** Aligned to `periods`; signed integer cents; 0 where the envelope had no flow that period. */
  amounts: number[];
  /** Row sum (signed cents). */
  total: number;
}

export interface EnvelopeSpendRollup {
  grain: SpendGrain;
  /** Ascending; "YYYY-MM" (month grain) or "YYYY" (year grain). Only periods with activity. */
  periods: string[];
  /** One per envelope WITH activity, ordered by name. */
  rows: EnvelopeSpendRow[];
  /** Column sums, aligned to `periods` (signed cents). */
  periodTotals: number[];
  /** Σ all cells (signed cents). */
  grandTotal: number;
}

const HH = DEFAULT_HOUSEHOLD_ID;

export function makeAnalysisService(db: Kysely<DB>) {
  return {
    /**
     * Net signed allocation flow per envelope per period (FEAT-011) — the generated replacement for
     * the spreadsheet's hand-keyed "18 Monthly" tab. A cell is `Σ allocation.amount_cents` for the
     * envelope's allocations whose **transaction** fell in the period: `+` = net funded, `−` = net
     * spent (allocations are already signed; a refund row keeps its stored sign).
     *
     * Envelope↔envelope reallocations are **excluded** by construction — this reads `allocations`
     * only, never `envelope_transfers` (owner decision, FEAT-011 §11). Archived envelopes are
     * **included** (history is preserved). Read-only aggregate; money stays integer cents (summed in
     * SQL, narrowed at the boundary).
     */
    async envelopeSpend(grain: SpendGrain): Promise<EnvelopeSpendRollup> {
      // `grain` is a closed enum validated at the boundary, so the format is a safe literal.
      const fmt = grain === "year" ? "YYYY" : "YYYY-MM";
      const periodExpr = sql<string>`to_char(t.occurred_on, ${sql.lit(fmt)})`;

      const rows = await db
        .selectFrom("allocations as al")
        .innerJoin("transactions as t", "t.id", "al.transaction_id")
        .innerJoin("envelopes as e", "e.id", "al.envelope_id")
        .where("t.household_id", "=", HH)
        .select([
          "al.envelope_id as envelope_id",
          "e.name as envelope_name",
          "e.archived_at as archived_at",
          periodExpr.as("period"),
          sql<string>`sum(al.amount_cents)`.as("net_cents"),
        ])
        .groupBy(["al.envelope_id", "e.name", "e.archived_at", periodExpr])
        .orderBy("e.name")
        .execute();

      // Distinct periods, ascending — lexicographic order is chronological for YYYY-MM / YYYY.
      const periods = [...new Set(rows.map((r) => r.period))].sort();

      // Bucket by envelope (insertion order follows the name-ordered query, so rows come out by name).
      const byEnvelope = groupBy(
        rows,
        (r) => r.envelope_id,
        (r) => r,
      );

      const periodTotal = new Map<string, number>();
      const outRows: EnvelopeSpendRow[] = [];
      for (const [envelopeId, envRows] of byEnvelope) {
        const first = envRows[0];
        if (!first) continue; // groupBy never yields an empty bucket; satisfies the type checker
        const netByPeriod = new Map<string, number>();
        for (const r of envRows) {
          const net = Number(r.net_cents ?? 0);
          netByPeriod.set(r.period, (netByPeriod.get(r.period) ?? 0) + net);
          periodTotal.set(r.period, (periodTotal.get(r.period) ?? 0) + net);
        }
        const amounts = periods.map((p) => netByPeriod.get(p) ?? 0);
        outRows.push({
          envelopeId,
          envelopeName: first.envelope_name,
          archived: first.archived_at !== null,
          amounts,
          total: amounts.reduce((a, b) => a + b, 0),
        });
      }

      const periodTotals = periods.map((p) => periodTotal.get(p) ?? 0);
      const grandTotal = periodTotals.reduce((a, b) => a + b, 0);
      return { grain, periods, rows: outRows, periodTotals, grandTotal };
    },
  };
}
