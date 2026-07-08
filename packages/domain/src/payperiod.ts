// Pay-period planning (FEAT-S7) — the sheet's paycheck buckets, derived. Pure date + money math
// over 'YYYY-MM-DD' strings and integer cents: no I/O, no Date.now (`today` is passed in). The
// impure shell (analysisService) gathers the same inputs as the forecast and feeds them here.
//
// The assignment policy is BALANCED LATEST-FIT, validated against the owner's real bills by
// SPIKE-10 (docs/spikes/10-payperiod-policy-validation.md): the originally-proposed date-only
// rule ("latest paycheck ≥ leadDays before due") was invalidated — due dates cluster at the
// month boundary, so it over-commits one check (~149%) while its neighbor idles — and capacity
// awareness is what the owner's hand method actually encodes. When capacity never binds, this
// reduces to the date-only rule.

import {
  type ActualSpendThisMonth,
  type ForecastRule,
  type ForecastTarget,
  expectedSpendEvents,
  scheduledEvents,
} from "./forecast";
import { splitEvenly } from "./money";

/** V1 constant (FEAT-S7 §5): money must arrive at least this many days before the bill. */
export const PAY_PERIOD_LEAD_DAYS = 7;

/** One bill occurrence inside a bucket. */
export interface PayPeriodBill {
  label: string;
  dueOn: string; // YYYY-MM-DD
  amountCents: number; // positive magnitude
}

/**
 * One bucket of the plan: the leading "from current balance" bucket (kind "balance",
 * committed at `today`) or one expected paycheck (committed at its payday).
 */
export interface PayPeriodBucket {
  kind: "balance" | "paycheck";
  label: string; // paycheck rule label; "" for the balance bucket
  /** Payday for a paycheck bucket; `today` for the balance bucket (its commitment time). */
  committedOn: string;
  incomeCents: number; // the paycheck amount; 0 for the balance bucket
  bills: PayPeriodBill[]; // due-date-sorted
  plannedSpendCents: number; // this bucket's share of the month's netted residual (SPIKE-05)
  totalCents: number; // Σ bills + plannedSpend
  /** True when a paycheck bucket's total exceeds its income (the §5 overflow fallback). */
  overCommitted: boolean;
  /** Running headroom AFTER this bucket commits: balance + Σ income − Σ committed so far. */
  headroomAfterCents: number;
  /**
   * Projected ACCOUNT balance on this bucket's commitment date (FEAT-UXR2) — the forecast's
   * cash-flow math (scheduled events + `evenDaily` expected discretionary spend) read off as of
   * `committedOn`, so the planner's Balance column reconciles with the Forecast view for the same
   * account/date. The balance bucket reads the current balance (no forecast event falls on or
   * before `today`). This is a CASH-FLOW figure — distinct from the commitment-time headroom.
   */
  projectedBalanceCents: number;
  /**
   * The sheet's "Funds" (FEAT-UXR2): the running Σ of per-check headroom (income − committed)
   * through this bucket, seeded by bucket zero. Negative per-check headroom reduces the run (no
   * clamp), so an over-committed check draws the reserve down. Equal to `headroomAfterCents` by
   * construction — both fold (income − committed) onto the starting balance — but surfaced as its
   * own field (the planner's Reserve column) per the owner-resolved UX spec §11 Q1.
   */
  reserveCents: number;
}

export interface PayPeriodPlan {
  startDate: string; // today
  endDate: string; // today + horizonDays
  horizonDays: number;
  leadDays: number;
  startingBalanceCents: number;
  /** Balance bucket first (only when non-empty), then paycheck buckets in date order. */
  buckets: PayPeriodBucket[];
  /** `committedOn` of the first bucket whose headroom goes negative, or null. */
  firstBreakOn: string | null;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const monthOf = (dateStr: string): string => dateStr.slice(0, 7);

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d) + n * 24 * 60 * 60 * 1000);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

interface Paycheck {
  label: string;
  paidOn: string;
  incomeCents: number;
  bills: PayPeriodBill[];
  plannedSpendCents: number;
  spareCents: number; // income − plannedSpend − Σ assigned bills (may go negative on overflow)
}

/**
 * Assemble the plan. Inputs are the forecast's gather (FEAT-S7 §4): the account's derived
 * balance, its recurring rules, envelope monthly targets, actual spend this month, `today`.
 *
 * - Expected paychecks = every recurring DEPOSIT occurrence in (today, endDate] (never assigned).
 * - Planned spending = each month's netted residual (target − actual − scheduled, floored at 0 —
 *   reused from the forecast via `expectedSpendEvents`), split evenly across that month's
 *   paychecks; a month with no expected paycheck charges its residual to the balance bucket.
 * - Bills = every recurring WITHDRAWAL occurrence in (today, endDate], placed largest-first
 *   (ties: earlier due date, then label) into the LATEST paycheck dated ≥ `leadDays` before the
 *   due date that still has capacity; all feasible paychecks full → the latest feasible one
 *   (over-committed, surfaced); no feasible paycheck at all → the balance bucket.
 * - Headroom runs at COMMITMENT time (S8): after each bucket, balance + Σ income − Σ committed.
 */
export function payPeriodPlan(
  startingBalanceCents: number,
  today: string,
  rules: readonly ForecastRule[],
  targets: readonly ForecastTarget[],
  actualThisMonth: ActualSpendThisMonth,
  opts: { horizonDays: number; leadDays?: number },
): PayPeriodPlan {
  const horizonDays = opts.horizonDays;
  const leadDays = opts.leadDays ?? PAY_PERIOD_LEAD_DAYS;
  const endDate = addDays(today, horizonDays);

  // Scheduled occurrences in (today, endDate], via the proven recurring engine.
  const events = scheduledEvents(rules, today, endDate);
  const paychecks: Paycheck[] = events
    .filter((e) => e.deltaCents > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.label.localeCompare(b.label)))
    .map((e) => ({
      label: e.label,
      paidOn: e.date,
      incomeCents: e.deltaCents,
      bills: [],
      plannedSpendCents: 0,
      spareCents: e.deltaCents,
    }));
  const balanceBucketBills: PayPeriodBill[] = [];
  let balancePlannedSpendCents = 0;

  // Planned spending: one netted residual per month ("monthStart" collapses each month to a
  // single event), split evenly across that month's paychecks — three-check months split three
  // ways by construction (AC3). No paycheck that month → the residual draws on the balance.
  const paychecksByMonth = new Map<string, Paycheck[]>();
  for (const p of paychecks) {
    const key = monthOf(p.paidOn);
    const group = paychecksByMonth.get(key);
    if (group) group.push(p);
    else paychecksByMonth.set(key, [p]);
  }
  for (const e of expectedSpendEvents(
    targets,
    rules,
    actualThisMonth,
    today,
    endDate,
    "monthStart",
  )) {
    const residual = -e.deltaCents; // expected events carry negative deltas
    const group = paychecksByMonth.get(monthOf(e.date));
    if (!group) {
      balancePlannedSpendCents += residual;
      continue;
    }
    const shares = splitEvenly(residual, group.length);
    group.forEach((p, i) => {
      const share = shares[i] ?? 0;
      p.plannedSpendCents += share;
      p.spareCents -= share;
    });
  }

  // Balanced latest-fit (FEAT-S7 §5, SPIKE-10): largest bills placed first, each into the latest
  // feasible paycheck with room; overflow to the latest feasible; unfundable → balance bucket.
  const bills: PayPeriodBill[] = events
    .filter((e) => e.deltaCents < 0)
    .map((e) => ({ label: e.label, dueOn: e.date, amountCents: -e.deltaCents }));
  bills.sort(
    (a, b) =>
      b.amountCents - a.amountCents ||
      (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.label.localeCompare(b.label)),
  );
  for (const bill of bills) {
    const cutoff = addDays(bill.dueOn, -leadDays);
    const feasible = paychecks.filter((p) => p.paidOn <= cutoff);
    if (feasible.length === 0) {
      balanceBucketBills.push(bill);
      continue;
    }
    const withRoom = feasible.filter((p) => p.spareCents >= bill.amountCents);
    const chosen = (withRoom.length > 0 ? withRoom : feasible)[
      (withRoom.length > 0 ? withRoom : feasible).length - 1
    ] as Paycheck;
    chosen.bills.push(bill);
    chosen.spareCents -= bill.amountCents;
  }

  const byDue = (a: PayPeriodBill, b: PayPeriodBill): number =>
    a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.label.localeCompare(b.label);
  balanceBucketBills.sort(byDue);

  // Projected account balance at each commitment date (FEAT-UXR2, resolved Q1/Q2): the forecast's
  // own cash-flow walk — the same scheduled events plus `evenDaily` expected discretionary spend
  // (the Forecast view's defaults) — summed as of each `committedOn`, so the planner's Balance
  // column reconciles with the forecast for the same account/date. `evenDaily` here is independent
  // of the plan's `monthStart` planned-spend placement; Balance is a cash-flow figure, not the
  // commitment-time headroom.
  const forecastEvents = [
    ...events,
    ...expectedSpendEvents(targets, rules, actualThisMonth, today, endDate, "evenDaily"),
  ];
  const balanceAsOf = (date: string): number =>
    forecastEvents.reduce(
      (bal, e) => (e.date <= date ? bal + e.deltaCents : bal),
      startingBalanceCents,
    );

  // Assemble buckets in commitment order with the running headroom line (S8). `reserveCents` is
  // that same running headroom re-surfaced as the sheet's Funds (UX spec §11 Q1).
  const buckets: PayPeriodBucket[] = [];
  let headroom = startingBalanceCents;
  let firstBreakOn: string | null = null;
  const balanceTotal =
    balanceBucketBills.reduce((sum, b) => sum + b.amountCents, 0) + balancePlannedSpendCents;
  if (balanceBucketBills.length > 0 || balancePlannedSpendCents > 0) {
    headroom -= balanceTotal;
    if (firstBreakOn === null && headroom < 0) firstBreakOn = today;
    buckets.push({
      kind: "balance",
      label: "",
      committedOn: today,
      incomeCents: 0,
      bills: balanceBucketBills,
      plannedSpendCents: balancePlannedSpendCents,
      totalCents: balanceTotal,
      overCommitted: false,
      headroomAfterCents: headroom,
      projectedBalanceCents: balanceAsOf(today),
      reserveCents: headroom,
    });
  }
  for (const p of paychecks) {
    p.bills.sort(byDue);
    const total = p.bills.reduce((sum, b) => sum + b.amountCents, 0) + p.plannedSpendCents;
    headroom += p.incomeCents - total;
    if (firstBreakOn === null && headroom < 0) firstBreakOn = p.paidOn;
    buckets.push({
      kind: "paycheck",
      label: p.label,
      committedOn: p.paidOn,
      incomeCents: p.incomeCents,
      bills: p.bills,
      plannedSpendCents: p.plannedSpendCents,
      totalCents: total,
      overCommitted: total > p.incomeCents,
      headroomAfterCents: headroom,
      projectedBalanceCents: balanceAsOf(p.paidOn),
      reserveCents: headroom,
    });
  }

  return {
    startDate: today,
    endDate,
    horizonDays,
    leadDays,
    startingBalanceCents,
    buckets,
    firstBreakOn,
  };
}
