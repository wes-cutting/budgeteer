// Candidate cash-flow forecast model (the thing SPIKE-05 is here to prove).
//
// What it forecasts: ONE account's CASH balance, day-stepped over a horizon, starting from the
// account's derived current balance (the real app: v_account_balances).
//
// Inputs that drive it (owner chose BOTH, #13):
//   1. SCHEDULED recurring events  — concrete, dated; the firm core. Each recurring rule on the
//      account contributes ±magnitude on each future occurrence date (via the real engine).
//   2. EXPECTED discretionary spend — derived from #12 monthly targets, folded in WITHOUT
//      double-counting money the schedule or already-posted actuals already cover. This is the
//      fuzzy fork the spike exists to settle.
//
// Money is integer cents throughout. Pure: no I/O, no Date.now — `today` is passed in.

import { type RecurringFrequency, addDays, anchorDayOf, daysInMonthOf, dueOccurrences, monthOf } from "./recurring";

export type Cents = number; // integer

export interface RuleLine {
  envelopeId: string;
  magnitudeCents: Cents; // positive
  refund: boolean;
}

export interface RecurringRule {
  label: string;
  direction: "deposit" | "withdrawal";
  amountCents: Cents; // positive magnitude (cash effect on the account)
  frequency: RecurringFrequency;
  anchorOn: string; // YYYY-MM-DD
  nextOccurrenceOn: string; // YYYY-MM-DD (the rule's stored cursor)
  lines: RuleLine[]; // split lines (only withdrawal lines net against targets)
}

export interface Target {
  envelopeId: string;
  monthlyTargetCents: Cents; // positive
}

/** Already-posted spend this (current) month, per envelope — what budget-vs-actual would report. */
export type ActualSpendThisMonth = Map<string, Cents>;

export type SpendStrategy = "evenDaily" | "monthStart" | "monthEnd";

export interface ForecastOptions {
  horizonDays: number; // e.g. 90
  includeExpected: boolean; // fold targets in as expected discretionary spend?
  strategy?: SpendStrategy; // how to place a month's expected spend on the timeline (default evenDaily)
}

export interface ForecastEvent {
  date: string;
  deltaCents: Cents; // signed cash effect
  kind: "scheduled" | "expected";
  label: string;
}

export interface ForecastPoint extends ForecastEvent {
  balanceCents: Cents; // running balance AFTER applying this event
}

export interface Forecast {
  startDate: string;
  endDate: string;
  startingBalanceCents: Cents;
  points: ForecastPoint[];
  endingBalanceCents: Cents;
  minBalanceCents: Cents; // lowest running balance over the horizon (incl. the starting point)
  minBalanceDate: string;
  firstNegativeDate: string | null; // first date the running balance goes < 0, or null
}

const signOf = (direction: "deposit" | "withdrawal"): 1 | -1 => (direction === "deposit" ? 1 : -1);

/** Even integer-cent split of `total` across `n` slots; remainder lands on the EARLIEST slots. */
function splitEvenly(total: Cents, n: number): Cents[] {
  if (n <= 0) return [];
  const base = Math.trunc(total / n);
  let rem = total - base * n; // 0..n-1, same sign as total (total ≥ 0 here)
  return Array.from({ length: n }, () => {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem -= 1;
    return base + extra;
  });
}

/**
 * Every SCHEDULED cash event strictly after `today`, up to and including `endDate`. Reuses the
 * proven engine with the horizon as the bound; filters to `date > today` so the forecast plots
 * only the future (past-due-unposted occurrences stay the Recurring view's `dueCount` concern,
 * keeping the t=0 balance and every plotted point internally consistent).
 */
export function scheduledEvents(rules: RecurringRule[], today: string, endDate: string): ForecastEvent[] {
  const out: ForecastEvent[] = [];
  for (const r of rules) {
    const { dates } = dueOccurrences(r.nextOccurrenceOn, endDate, r.frequency, anchorDayOf(r.anchorOn));
    const delta = r.amountCents * signOf(r.direction);
    for (const date of dates) {
      if (date > today) out.push({ date, deltaCents: delta, kind: "scheduled", label: r.label });
    }
  }
  return out;
}

/** Net SCHEDULED outflow magnitude per envelope per month inside the window (withdrawals only). */
function scheduledOutflowByEnvMonth(
  rules: RecurringRule[],
  today: string,
  endDate: string,
): Map<string, Map<string, Cents>> {
  const byMonth = new Map<string, Map<string, Cents>>();
  const add = (month: string, env: string, c: Cents): void => {
    let m = byMonth.get(month);
    if (!m) byMonth.set(month, (m = new Map()));
    m.set(env, (m.get(env) ?? 0) + c);
  };
  for (const r of rules) {
    if (r.direction !== "withdrawal") continue; // funding deposits never count against a spend target
    const { dates } = dueOccurrences(r.nextOccurrenceOn, endDate, r.frequency, anchorDayOf(r.anchorOn));
    for (const date of dates) {
      if (date <= today) continue;
      for (const l of r.lines) add(monthOf(date), l.envelopeId, l.refund ? -l.magnitudeCents : l.magnitudeCents);
    }
  }
  return byMonth;
}

/** The list of "YYYY-MM" months the window (today, endDate] touches, ascending. */
function monthsInWindow(today: string, endDate: string): string[] {
  const months: string[] = [];
  let cur = monthOf(addDays(today, 1));
  const last = monthOf(endDate);
  while (cur <= last) {
    months.push(cur);
    const [y, m] = cur.split("-").map(Number) as [number, number];
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    cur = `${ny}-${String(nm).padStart(2, "0")}`;
  }
  return months;
}

/**
 * EXPECTED discretionary-spend events from monthly targets — the fuzzy fork, made concrete.
 *
 * Per target envelope, per month, the residual = the target MINUS what's already committed:
 *   - current month: target − actualSpentThisMonth − scheduledRemainingThisMonth
 *   - other months : target − scheduledThisMonth
 * floored at 0 (never negative). A refund line within a scheduled withdrawal raises the residual
 * (it gave money back). This is the anti-double-count rule: an envelope whose spend is fully
 * scheduled or already spent contributes ZERO expected spend (e.g. Rent, Utilities).
 *
 * Partial months (the current month, and the final month clipped by the horizon) are prorated by
 * (in-window days / days-in-month) for FUTURE months; the current month is not prorated because
 * "target − actual" is already the genuine remaining budget.
 *
 * The residual is summed across all target envelopes (V1 attribution: discretionary spend is paid
 * from the forecast account — envelopes carry no account link) and placed on the timeline by
 * `strategy`. Returns NEGATIVE deltas.
 */
export function expectedSpendEvents(
  targets: Target[],
  rules: RecurringRule[],
  actualThisMonth: ActualSpendThisMonth,
  today: string,
  endDate: string,
  strategy: SpendStrategy,
): ForecastEvent[] {
  const out: ForecastEvent[] = [];
  const schedOut = scheduledOutflowByEnvMonth(rules, today, endDate);
  const currentMonth = monthOf(today);

  for (const month of monthsInWindow(today, endDate)) {
    const isCurrent = month === currentMonth;
    // In-window day range for this month.
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(daysInMonthOf(month)).padStart(2, "0")}`;
    const winStart = isCurrent ? addDays(today, 1) : monthStart > addDays(today, 1) ? monthStart : addDays(today, 1);
    const winEnd = endDate < monthEnd ? endDate : monthEnd;
    if (winStart > winEnd) continue;
    const inWindowDays = dayDiff(winStart, winEnd) + 1;
    const daysInMonth = daysInMonthOf(month);
    const isPartialFuture = !isCurrent && inWindowDays < daysInMonth;

    let monthResidual = 0;
    for (const t of targets) {
      const sched = schedOut.get(month)?.get(t.envelopeId) ?? 0;
      const actual = isCurrent ? (actualThisMonth.get(t.envelopeId) ?? 0) : 0;
      let residual = t.monthlyTargetCents - actual - sched;
      if (residual < 0) residual = 0;
      if (isPartialFuture) residual = Math.trunc((residual * inWindowDays) / daysInMonth);
      monthResidual += residual;
    }
    if (monthResidual <= 0) continue;

    if (strategy === "monthStart") {
      out.push({ date: winStart, deltaCents: -monthResidual, kind: "expected", label: "Expected discretionary spend" });
    } else if (strategy === "monthEnd") {
      out.push({ date: winEnd, deltaCents: -monthResidual, kind: "expected", label: "Expected discretionary spend" });
    } else {
      const portions = splitEvenly(monthResidual, inWindowDays);
      for (let i = 0; i < inWindowDays; i++) {
        const p = portions[i] ?? 0;
        if (p > 0) out.push({ date: addDays(winStart, i), deltaCents: -p, kind: "expected", label: "Expected discretionary spend" });
      }
    }
  }
  return out;
}

/** Whole-day difference winEnd − winStart (both 'YYYY-MM-DD'), via UTC epoch days. */
function dayDiff(a: string, b: string): number {
  const toEpochDay = (s: string): number => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Math.round(Date.UTC(y, m - 1, d) / (24 * 60 * 60 * 1000));
  };
  return toEpochDay(b) - toEpochDay(a);
}

/** PURE event-stepping core: start balance + dated signed events → running-balance series. */
export function runningBalance(
  startingBalanceCents: Cents,
  startDate: string,
  endDate: string,
  events: ForecastEvent[],
): Forecast {
  // Conservative same-day ordering: apply the most-negative delta first, so the intraday min is
  // the honest "could I bounce?" floor. (date asc, then deltaCents asc.)
  const sorted = [...events].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.deltaCents - y.deltaCents));

  let balance = startingBalanceCents;
  let minBalance = startingBalanceCents;
  let minDate = startDate;
  let firstNegativeDate: string | null = null;
  const points: ForecastPoint[] = [];

  for (const e of sorted) {
    balance += e.deltaCents;
    points.push({ ...e, balanceCents: balance });
    if (balance < minBalance) {
      minBalance = balance;
      minDate = e.date;
    }
    if (firstNegativeDate === null && balance < 0) firstNegativeDate = e.date;
  }

  return {
    startDate,
    endDate,
    startingBalanceCents,
    points,
    endingBalanceCents: balance,
    minBalanceCents: minBalance,
    minBalanceDate: minDate,
    firstNegativeDate,
  };
}

/** Top-level assembly: scheduled (+ optionally expected) events → forecast. */
export function buildForecast(
  startingBalanceCents: Cents,
  today: string,
  rules: RecurringRule[],
  targets: Target[],
  actualThisMonth: ActualSpendThisMonth,
  opts: ForecastOptions,
): Forecast {
  const endDate = addDays(today, opts.horizonDays);
  const events = scheduledEvents(rules, today, endDate);
  if (opts.includeExpected) {
    events.push(...expectedSpendEvents(targets, rules, actualThisMonth, today, endDate, opts.strategy ?? "evenDaily"));
  }
  return runningBalance(startingBalanceCents, today, endDate, events);
}
