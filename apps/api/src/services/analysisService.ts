import { type Kysely, sql } from "kysely";
import {
  type AccountKind,
  type CreditAccountInput,
  type CreditUtilizationReport,
  type DebtPayoffReport,
  type Forecast,
  type ForecastRule,
  type ForecastTarget,
  type LoanAccountInput,
  type NetWorthFlow,
  type NetWorthReport,
  type PayPeriodPlan,
  type RecurringFrequency,
  cashFlowForecast as computeForecast,
  payPeriodPlan as computePayPeriodPlan,
  creditUtilization as computeCreditUtilization,
  debtPayoff as computeDebtPayoff,
  netWorthOverTime as computeNetWorth,
} from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import { groupBy } from "../util/groupBy";
import { toDateStr } from "../util/dates";
import { NotFoundError } from "./errors";

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

/** The pure-domain `Forecast` plus the account it was projected for (FEAT-013). */
export interface CashFlowForecast extends Forecast {
  accountId: string;
  accountName: string;
}

/** The pure-domain `PayPeriodPlan` plus the account it was planned for (FEAT-S7). */
export interface PayPeriodPlanView extends PayPeriodPlan {
  accountId: string;
  accountName: string;
}

/** The pure-domain `NetWorthReport` plus the grain it was rolled up at (FEAT-R9). */
export interface NetWorthRollup extends NetWorthReport {
  grain: SpendGrain;
}

const HH = DEFAULT_HOUSEHOLD_ID;

/** Everything the projecting reads (forecast, pay-period plan) start from — one gather. */
interface ProjectionInputs {
  account: { id: string; name: string };
  startingBalanceCents: number;
  rules: ForecastRule[];
  targets: ForecastTarget[];
  actualThisMonth: Map<string, number>;
}

/**
 * Gather the projection inputs for one account (FEAT-013 §4, reused verbatim by FEAT-S7): the
 * derived balance (`v_account_balances`), the account's recurring rules + split lines, the
 * household's envelope targets, and the current month's actual outflow per envelope (the
 * FEAT-012 basis: −Σ allocations on withdrawals). Throws NotFoundError for an unknown account.
 */
async function gatherProjectionInputs(
  db: Kysely<DB>,
  accountId: string,
  today: string,
): Promise<ProjectionInputs> {
  const account = await db
    .selectFrom("accounts")
    .select(["id", "name"])
    .where("id", "=", accountId)
    .where("household_id", "=", HH)
    .executeTakeFirst();
  if (!account) throw new NotFoundError("account");

  const bal = await db
    .selectFrom("v_account_balances")
    .select("balance_cents")
    .where("account_id", "=", accountId)
    .executeTakeFirst();
  const startingBalanceCents = Number(bal?.balance_cents ?? 0);

  // Recurring rules on this account (the scheduled events) + their split lines.
  const ruleRows = await db
    .selectFrom("recurring_transactions")
    .select([
      "id",
      "direction",
      "amount_cents",
      "payee",
      "frequency",
      "anchor_on",
      "next_occurrence_on",
    ])
    .where("household_id", "=", HH)
    .where("account_id", "=", accountId)
    .execute();
  const lineRows =
    ruleRows.length === 0
      ? []
      : await db
          .selectFrom("recurring_lines")
          .select(["recurring_id", "envelope_id", "amount_cents", "refund"])
          .where(
            "recurring_id",
            "in",
            ruleRows.map((r) => r.id),
          )
          .execute();
  const linesByRule = groupBy(
    lineRows,
    (r) => r.recurring_id,
    (r) => ({
      envelopeId: r.envelope_id,
      magnitudeCents: Number(r.amount_cents),
      refund: Boolean(r.refund),
    }),
  );
  const rules: ForecastRule[] = ruleRows.map((r) => ({
    label: r.payee ?? (r.direction === "deposit" ? "Deposit" : "Withdrawal"),
    direction: r.direction === "deposit" ? "deposit" : "withdrawal",
    amountCents: Number(r.amount_cents),
    frequency: r.frequency as RecurringFrequency,
    anchorOn: toDateStr(r.anchor_on),
    nextOccurrenceOn: toDateStr(r.next_occurrence_on),
    lines: linesByRule.get(r.id) ?? [],
  }));

  // Targets (the budget side, household-wide).
  const targetRows = await db
    .selectFrom("envelope_targets")
    .select(["envelope_id", "monthly_target_cents"])
    .where("household_id", "=", HH)
    .execute();
  const targets: ForecastTarget[] = targetRows.map((r) => ({
    envelopeId: r.envelope_id,
    monthlyTargetCents: Number(r.monthly_target_cents),
  }));

  // Current-month actual outflow per envelope (the FEAT-012 basis: −Σ allocations on withdrawals).
  const month = today.slice(0, 7);
  const spendRows = await db
    .selectFrom("allocations as al")
    .innerJoin("transactions as t", "t.id", "al.transaction_id")
    .where("t.household_id", "=", HH)
    .where(sql<boolean>`t.amount_cents < 0`)
    .where(sql<boolean>`to_char(t.occurred_on, 'YYYY-MM') = ${month}`)
    .select(["al.envelope_id as envelope_id", sql<string>`sum(al.amount_cents)`.as("net_cents")])
    .groupBy("al.envelope_id")
    .execute();
  const actualThisMonth = new Map(spendRows.map((r) => [r.envelope_id, -Number(r.net_cents ?? 0)]));

  return { account, startingBalanceCents, rules, targets, actualThisMonth };
}

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

    /**
     * Cash-flow forecast for one account (FEAT-013): project its running cash balance forward over
     * `horizonDays`, starting from the derived balance (`v_account_balances`), applying future
     * scheduled recurring events and — when `includeExpected` — expected discretionary spend from
     * targets (netted to avoid double-counting). This read only **gathers** the inputs; the
     * projection itself is the pure domain `cashFlowForecast` (proven by SPIKE-05). Read-only — no
     * new table or view. Money stays integer cents (narrowed at the boundary).
     */
    async cashFlowForecast(
      accountId: string,
      // `today` is the caller's local calendar date (EH8) — the projection's day zero.
      opts: { horizonDays: number; includeExpected: boolean; today: string },
    ): Promise<CashFlowForecast> {
      const { account, startingBalanceCents, rules, targets, actualThisMonth } =
        await gatherProjectionInputs(db, accountId, opts.today);
      const forecast = computeForecast(
        startingBalanceCents,
        opts.today,
        rules,
        targets,
        actualThisMonth,
        {
          horizonDays: opts.horizonDays,
          includeExpected: opts.includeExpected,
        },
      );
      return { accountId: account.id, accountName: account.name, ...forecast };
    },

    /**
     * Pay-period plan for one account (FEAT-S7): expected paychecks become buckets, each bill
     * occurrence is assigned by the SPIKE-10-validated balanced latest-fit policy, planned
     * spending is the SPIKE-05-netted monthly residual split across that month's checks, and a
     * commitment-time headroom line runs down the plan (S8). Same gather as the forecast — the
     * plan itself is the pure domain `payPeriodPlan`. Read-only; no schema change.
     */
    async payPeriodPlan(
      accountId: string,
      // `today` is the caller's local calendar date (EH8) — the plan's day zero.
      opts: { horizonDays: number; today: string },
    ): Promise<PayPeriodPlanView> {
      const { account, startingBalanceCents, rules, targets, actualThisMonth } =
        await gatherProjectionInputs(db, accountId, opts.today);
      const plan = computePayPeriodPlan(
        startingBalanceCents,
        opts.today,
        rules,
        targets,
        actualThisMonth,
        { horizonDays: opts.horizonDays },
      );
      return { accountId: account.id, accountName: account.name, ...plan };
    },

    /**
     * Credit utilization for every credit account (FEAT-014a): each account's owed balance against
     * its stored limit (owed/limit), plus a month-by-month utilization trend, plus a portfolio
     * roll-up over the accounts that have a limit. "Owed" is the derived balance read off
     * `v_account_balances` (a credit account's balance ≤ 0 = debt; owed = −balance) — never stored.
     *
     * This read only **gathers** the inputs; the math (owed, utilization basis points, the cumulative
     * trend, the roll-up) is the pure domain `creditUtilization`. Read-only — the only new table is
     * the `credit_limits` config (written by creditLimitService). Money stays integer cents (summed in
     * SQL, narrowed at the boundary). Credit accounts are shown when active, or (when archived) only
     * if they still carry a limit or a non-zero balance; ordered by name.
     */
    async creditUtilization(): Promise<CreditUtilizationReport> {
      const accountRows = await db
        .selectFrom("accounts")
        .select(["id", "name", "archived_at"])
        .where("household_id", "=", HH)
        .where("kind", "=", "credit")
        .orderBy("name")
        .execute();
      if (accountRows.length === 0) return computeCreditUtilization([]);
      const accountIds = accountRows.map((a) => a.id);

      const balanceRows = await db
        .selectFrom("v_account_balances")
        .select(["account_id", "balance_cents"])
        .where("account_id", "in", accountIds)
        .execute();
      const balanceByAccount = new Map(
        balanceRows.map((r) => [r.account_id, Number(r.balance_cents ?? 0)]),
      );

      const limitRows = await db
        .selectFrom("credit_limits")
        .select(["account_id", "credit_limit_cents"])
        .where("household_id", "=", HH)
        .execute();
      const limitByAccount = new Map(
        limitRows.map((r) => [r.account_id, Number(r.credit_limit_cents)]),
      );

      // Per-account, per-month net balance flow (signed). Cumulating these (ascending) reconstructs
      // the account's balance at each period end — the basis for the utilization trend.
      const flowRows = await db
        .selectFrom("transactions")
        .where("household_id", "=", HH)
        .where("account_id", "in", accountIds)
        .select([
          "account_id",
          sql<string>`to_char(occurred_on, 'YYYY-MM')`.as("period"),
          sql<string>`sum(amount_cents)`.as("net_cents"),
        ])
        .groupBy(["account_id", sql`to_char(occurred_on, 'YYYY-MM')`])
        .orderBy("account_id")
        .orderBy("period")
        .execute();
      const flowsByAccount = groupBy(
        flowRows,
        (r) => r.account_id,
        (r) => ({ period: r.period, netCents: Number(r.net_cents ?? 0) }),
      );

      const inputs: CreditAccountInput[] = [];
      for (const a of accountRows) {
        const balanceCents = balanceByAccount.get(a.id) ?? 0;
        const limitCents = limitByAccount.get(a.id) ?? null;
        const archived = a.archived_at !== null;
        // Hide archived credit accounts that are dormant (no limit, settled balance); keep all active.
        if (archived && limitCents === null && balanceCents === 0) continue;
        inputs.push({
          accountId: a.id,
          accountName: a.name,
          archived,
          balanceCents,
          limitCents,
          flows: flowsByAccount.get(a.id) ?? [],
        });
      }

      return computeCreditUtilization(inputs);
    },

    /**
     * Debt payoff for every loan account (FEAT-014b): how much of each loan's **original principal**
     * has been paid down (`1 − owed/original`), plus a month-by-month payoff trend and a portfolio
     * roll-up over the loans that have an original principal. "Owed" is the derived balance
     * (`v_account_balances`) interpreted as a liability — `owed = −balance` (a loan carries its debt
     * as a negative balance) — never stored.
     *
     * This read only **gathers** the inputs; the math (owed, payoff basis points, the cumulative
     * trend, the roll-up) is the pure domain `debtPayoff`. Read-only — the only new table is the
     * `loan_principals` config (written by loanPrincipalService). The structure mirrors
     * `creditUtilization` (#14a): loan accounts shown when active, or (archived) only if they still
     * carry a principal or a non-zero balance; ordered by name. Money stays integer cents.
     */
    async debtPayoff(): Promise<DebtPayoffReport> {
      const accountRows = await db
        .selectFrom("accounts")
        .select(["id", "name", "archived_at"])
        .where("household_id", "=", HH)
        .where("kind", "=", "loan")
        .orderBy("name")
        .execute();
      if (accountRows.length === 0) return computeDebtPayoff([]);
      const accountIds = accountRows.map((a) => a.id);

      const balanceRows = await db
        .selectFrom("v_account_balances")
        .select(["account_id", "balance_cents"])
        .where("account_id", "in", accountIds)
        .execute();
      const balanceByAccount = new Map(
        balanceRows.map((r) => [r.account_id, Number(r.balance_cents ?? 0)]),
      );

      const principalRows = await db
        .selectFrom("loan_principals")
        .select(["account_id", "original_principal_cents"])
        .where("household_id", "=", HH)
        .execute();
      const principalByAccount = new Map(
        principalRows.map((r) => [r.account_id, Number(r.original_principal_cents)]),
      );

      // Per-account, per-month net balance flow (signed) — cumulated for the payoff trend, exactly as
      // in creditUtilization.
      const flowRows = await db
        .selectFrom("transactions")
        .where("household_id", "=", HH)
        .where("account_id", "in", accountIds)
        .select([
          "account_id",
          sql<string>`to_char(occurred_on, 'YYYY-MM')`.as("period"),
          sql<string>`sum(amount_cents)`.as("net_cents"),
        ])
        .groupBy(["account_id", sql`to_char(occurred_on, 'YYYY-MM')`])
        .orderBy("account_id")
        .orderBy("period")
        .execute();
      const flowsByAccount = groupBy(
        flowRows,
        (r) => r.account_id,
        (r) => ({ period: r.period, netCents: Number(r.net_cents ?? 0) }),
      );

      const inputs: LoanAccountInput[] = [];
      for (const a of accountRows) {
        const balanceCents = balanceByAccount.get(a.id) ?? 0;
        const originalPrincipalCents = principalByAccount.get(a.id) ?? null;
        const archived = a.archived_at !== null;
        // Hide archived loan accounts that are dormant (no principal, settled balance); keep all active.
        if (archived && originalPrincipalCents === null && balanceCents === 0) continue;
        inputs.push({
          accountId: a.id,
          accountName: a.name,
          archived,
          balanceCents,
          originalPrincipalCents,
          flows: flowsByAccount.get(a.id) ?? [],
        });
      }

      return computeDebtPayoff(inputs);
    },

    /**
     * Net worth over time (FEAT-R9) — the account-level "how am I doing overall?" aggregate the
     * analysis area was missing. For each period it sums every account's net balance flow, split by
     * the account's KIND into assets vs. liabilities (credit/loan), then cumulates ascending into a
     * period-end Assets / Liabilities / Net trend. By the sign convention (ADR-0003), a liability's
     * balance is negative (debt), so net = assets + liabilities falls out directly and account
     * transfer legs net to zero across the two accounts (so they neither distort nor double-count).
     *
     * This read only **gathers** the inputs (per-period, per-kind net flows over ALL transactions —
     * no kind/transfer exclusions, no envelope_transfers); the math is the pure domain
     * `netWorthOverTime`. Read-only aggregate — **no schema change** — and the same monthly-grid
     * pattern as #11. Money stays integer cents (summed in SQL, narrowed at the boundary). `grain` is
     * a closed enum validated at the boundary, so the format is a safe literal.
     */
    async netWorth(grain: SpendGrain): Promise<NetWorthRollup> {
      const fmt = grain === "year" ? "YYYY" : "YYYY-MM";
      const periodExpr = sql<string>`to_char(t.occurred_on, ${sql.lit(fmt)})`;

      const rows = await db
        .selectFrom("transactions as t")
        .innerJoin("accounts as a", "a.id", "t.account_id")
        .where("t.household_id", "=", HH)
        .select([
          "a.kind as kind",
          periodExpr.as("period"),
          sql<string>`sum(t.amount_cents)`.as("net_cents"),
        ])
        .groupBy(["a.kind", periodExpr])
        .execute();

      const flows: NetWorthFlow[] = rows.map((r) => ({
        period: r.period,
        kind: r.kind as AccountKind,
        netCents: Number(r.net_cents ?? 0),
      }));

      return { grain, ...computeNetWorth(flows) };
    },
  };
}
