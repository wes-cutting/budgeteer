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

export interface BudgetVsActualRow {
  envelopeId: string;
  envelopeName: string;
  archived: boolean;
  /** The envelope's monthly target (positive cents), or null when no target is set. */
  targetCents: number | null;
  /** Net spend (outflow) in the month: −Σ allocations on withdrawal transactions; ≥ 0 normally. */
  spentCents: number;
  /** `target − spent` (positive = under budget / money left); null when no target. */
  remainingCents: number | null;
}

export interface BudgetVsActualReport {
  /** The period compared, "YYYY-MM". */
  month: string;
  /** Envelopes that are active OR have a target OR had spend this month, ordered by name. */
  rows: BudgetVsActualRow[];
  /** Σ targets over rows that have one. */
  totalTargetCents: number;
  /** Σ spend over all rows (includes spend on un-budgeted envelopes). */
  totalSpentCents: number;
  /** Σ remaining over budgeted rows (= totalTarget − spend on budgeted envelopes). */
  totalRemainingCents: number;
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

    /**
     * Budget vs. actual for one month (FEAT-012): each envelope's monthly **target** (the budget)
     * against its **actual spend** (the outflow) that month, with the remaining budget.
     *
     * "Actual spend" is the owner's chosen basis (spend-only/outflow): `−Σ allocation.amount_cents`
     * over allocations whose **transaction is a withdrawal** (`amount_cents < 0`). This excludes
     * funding deposits by construction and **nets refund rows** (a refund is a `+` allocation on a
     * withdrawal — FEAT-008) against spend, so it reads as "what I net-spent from this envelope".
     * Envelope↔envelope reallocations carry no allocations, so they're excluded (as in #11).
     *
     * `remaining = target − spent` (positive = under budget). Rows cover every **active** envelope
     * plus any archived envelope that has a target or spend this month, ordered by name. Read-only;
     * money stays integer cents (summed in SQL, narrowed at the boundary). `month` is "YYYY-MM",
     * validated at the boundary.
     */
    async budgetVsActual(month: string): Promise<BudgetVsActualReport> {
      const spendRows = await db
        .selectFrom("allocations as al")
        .innerJoin("transactions as t", "t.id", "al.transaction_id")
        .where("t.household_id", "=", HH)
        .where(sql<boolean>`t.amount_cents < 0`) // outflow transactions only — funding excluded
        .where(sql<boolean>`to_char(t.occurred_on, 'YYYY-MM') = ${month}`)
        .select([
          "al.envelope_id as envelope_id",
          sql<string>`sum(al.amount_cents)`.as("net_cents"),
        ])
        .groupBy("al.envelope_id")
        .execute();

      const targetRows = await db
        .selectFrom("envelope_targets")
        .where("household_id", "=", HH)
        .select(["envelope_id", "monthly_target_cents"])
        .execute();

      const envRows = await db
        .selectFrom("envelopes")
        .where("household_id", "=", HH)
        .select(["id", "name", "archived_at"])
        .orderBy("name")
        .execute();

      // Net spend is −(Σ signed allocations on withdrawal txns); refunds (+ rows) net it down.
      const spentByEnv = new Map(spendRows.map((r) => [r.envelope_id, -Number(r.net_cents ?? 0)]));
      const targetByEnv = new Map(
        targetRows.map((r) => [r.envelope_id, Number(r.monthly_target_cents)]),
      );

      let totalTargetCents = 0;
      let totalSpentCents = 0;
      let totalRemainingCents = 0;
      const rows: BudgetVsActualRow[] = [];
      for (const e of envRows) {
        const hasTarget = targetByEnv.has(e.id);
        const hasSpend = spentByEnv.has(e.id);
        if (e.archived_at !== null && !hasTarget && !hasSpend) continue;
        const targetCents = hasTarget ? (targetByEnv.get(e.id) as number) : null;
        const spentCents = spentByEnv.get(e.id) ?? 0;
        const remainingCents = targetCents === null ? null : targetCents - spentCents;
        if (targetCents !== null) {
          totalTargetCents += targetCents;
          totalRemainingCents += remainingCents as number;
        }
        totalSpentCents += spentCents;
        rows.push({
          envelopeId: e.id,
          envelopeName: e.name,
          archived: e.archived_at !== null,
          targetCents,
          spentCents,
          remainingCents,
        });
      }

      return { month, rows, totalTargetCents, totalSpentCents, totalRemainingCents };
    },
  };
}
