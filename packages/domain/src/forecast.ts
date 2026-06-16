// Cash-flow forecast (FEAT-013) — the analysis area's one PROJECTING capability. Pure date + money
// math over 'YYYY-MM-DD' strings and integer cents: no I/O, no Date.now (`today` is passed in), so
// the projection is unit-testable in isolation. The impure shell (analysisService) gathers the
// inputs (derived balance, recurring rules, targets, current-month actuals) and feeds them here.
//
// Proven by SPIKE-05 (docs/spikes/05-cashflow-forecast.md): the recurring engine projects the future
// unchanged when fed the horizon as its bound; expected discretionary spend from targets is netted
// (target − actual − scheduled, floored at 0) so already-scheduled/already-spent money is never
// double-counted.

import { daysInMonth } from "./recurring";
import { type RecurringFrequency, anchorDayOf, dueOccurrences } from "./recurring";
import { splitEvenly } from "./money";

export const FORECAST_HORIZON_MIN = 7;
export const FORECAST_HORIZON_MAX = 365;
export const FORECAST_HORIZON_DEFAULT = 90;

export type SpendStrategy = "evenDaily" | "monthStart" | "monthEnd";

/** A split line on a recurring rule (only WITHDRAWAL lines net against a target). */
export interface ForecastRuleLine {
  envelopeId: string;
  magnitudeCents: number; // positive
  refund: boolean;
}

/** One recurring rule on the forecast account (FEAT-009), plus a display label. */
export interface ForecastRule {
  label: string;
  direction: "deposit" | "withdrawal";
  amountCents: number; // positive magnitude (the account-cash effect)
  frequency: RecurringFrequency;
  anchorOn: string; // YYYY-MM-DD
  nextOccurrenceOn: string; // YYYY-MM-DD (the rule's stored cursor)
  lines: ForecastRuleLine[];
}

export interface ForecastTarget {
  envelopeId: string;
  monthlyTargetCents: number; // positive
}

/** Already-posted outflow this (current) month, per envelope — what budget-vs-actual reports. */
export type ActualSpendThisMonth = ReadonlyMap<string, number>;

export interface ForecastOptions {
  horizonDays: number; // clamped to [MIN, MAX]
  includeExpected: boolean; // fold targets in as expected discretionary spend?
  strategy?: SpendStrategy; // default "evenDaily"
}

export interface ForecastEvent {
  date: string; // YYYY-MM-DD
  deltaCents: number; // signed cash effect
  kind: "scheduled" | "expected";
  label: string;
}

export interface ForecastPoint extends ForecastEvent {
  balanceCents: number; // running balance AFTER applying this event
}

export interface Forecast {
  startDate: string; // today
  endDate: string; // today + horizonDays
  horizonDays: number;
  includeExpected: boolean;
  startingBalanceCents: number;
  points: ForecastPoint[]; // date-ascending (conservative same-day order)
  endingBalanceCents: number;
  minBalanceCents: number; // lowest running balance over the horizon (incl. the starting point)
  minBalanceDate: string;
  firstNegativeDate: string | null; // first date the running balance goes < 0, or null
}

export const clampHorizon = (days: number): number =>
  Math.min(FORECAST_HORIZON_MAX, Math.max(FORECAST_HORIZON_MIN, Math.trunc(days)));

const signOf = (direction: "deposit" | "withdrawal"): 1 | -1 => (direction === "deposit" ? 1 : -1);
const pad2 = (n: number): string => String(n).padStart(2, "0");
const monthOf = (dateStr: string): string => dateStr.slice(0, 7);

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d) + n * 24 * 60 * 60 * 1000);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function daysInMonthOf(month: string): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return daysInMonth(y, m);
}

/** Whole-day difference b − a (both 'YYYY-MM-DD'), via UTC epoch days. */
function dayDiff(a: string, b: string): number {
  const toEpochDay = (s: string): number => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Math.round(Date.UTC(y, m - 1, d) / (24 * 60 * 60 * 1000));
  };
  return toEpochDay(b) - toEpochDay(a);
}

/**
 * Every SCHEDULED cash event strictly after `today`, up to and including `endDate`. Reuses the
 * proven recurring engine (`dueOccurrences`) with the horizon as its bound, then filters to
 * `date > today` so past-due-unposted occurrences (the Recurring view's `dueCount`) stay out —
 * keeping the t=0 balance and every plotted point internally consistent with the derived balance.
 */
export function scheduledEvents(
  rules: readonly ForecastRule[],
  today: string,
  endDate: string,
): ForecastEvent[] {
  const out: ForecastEvent[] = [];
  for (const r of rules) {
    const { dates } = dueOccurrences(
      r.nextOccurrenceOn,
      endDate,
      r.frequency,
      anchorDayOf(r.anchorOn),
    );
    const delta = r.amountCents * signOf(r.direction);
    for (const date of dates) {
      if (date > today) out.push({ date, deltaCents: delta, kind: "scheduled", label: r.label });
    }
  }
  return out;
}

/** Net SCHEDULED outflow magnitude per envelope per month inside the window (withdrawals only). */
function scheduledOutflowByEnvMonth(
  rules: readonly ForecastRule[],
  today: string,
  endDate: string,
): Map<string, Map<string, number>> {
  const byMonth = new Map<string, Map<string, number>>();
  const add = (month: string, env: string, c: number): void => {
    let m = byMonth.get(month);
    if (!m) byMonth.set(month, (m = new Map()));
    m.set(env, (m.get(env) ?? 0) + c);
  };
  for (const r of rules) {
    if (r.direction !== "withdrawal") continue; // funding deposits never count against a spend target
    const { dates } = dueOccurrences(
      r.nextOccurrenceOn,
      endDate,
      r.frequency,
      anchorDayOf(r.anchorOn),
    );
    for (const date of dates) {
      if (date <= today) continue;
      for (const l of r.lines)
        add(monthOf(date), l.envelopeId, l.refund ? -l.magnitudeCents : l.magnitudeCents);
    }
  }
  return byMonth;
}

/** The "YYYY-MM" months the window (today, endDate] touches, ascending. */
function monthsInWindow(today: string, endDate: string): string[] {
  const months: string[] = [];
  let cur = monthOf(addDays(today, 1));
  const last = monthOf(endDate);
  while (cur <= last) {
    months.push(cur);
    const [y, m] = cur.split("-").map(Number) as [number, number];
    cur = m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`;
  }
  return months;
}

/**
 * EXPECTED discretionary-spend events from monthly targets (the modeling decision, SPIKE-05).
 *
 * Per target envelope, per month, residual = target MINUS what's already committed, floored at 0:
 *   - current month: target − actualThisMonth − scheduledRemainingThisMonth (the genuine remaining
 *     budget; NOT prorated — proration is already implicit in "actual so far")
 *   - other months : target − scheduledThisMonth, prorated by (in-window days / days in month) when
 *     the window clips the month
 * A refund line within a scheduled withdrawal raises the residual (it returned money). The
 * floor-at-0 + netting is the anti-double-count rule: a fully-scheduled or already-spent envelope
 * (Rent, Utilities) contributes ZERO expected spend.
 *
 * The month's residual is summed across all target envelopes (V1 attribution: discretionary spend
 * is paid from the forecast account — envelopes carry no account link) and placed on the timeline by
 * `strategy`. Returns NEGATIVE deltas.
 */
export function expectedSpendEvents(
  targets: readonly ForecastTarget[],
  rules: readonly ForecastRule[],
  actualThisMonth: ActualSpendThisMonth,
  today: string,
  endDate: string,
  strategy: SpendStrategy = "evenDaily",
): ForecastEvent[] {
  const out: ForecastEvent[] = [];
  const schedOut = scheduledOutflowByEnvMonth(rules, today, endDate);
  const currentMonth = monthOf(today);
  const label = "Expected discretionary spend";

  for (const month of monthsInWindow(today, endDate)) {
    const isCurrent = month === currentMonth;
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${pad2(daysInMonthOf(month))}`;
    const firstWindowDay = addDays(today, 1);
    const winStart = isCurrent
      ? firstWindowDay
      : monthStart > firstWindowDay
        ? monthStart
        : firstWindowDay;
    const winEnd = endDate < monthEnd ? endDate : monthEnd;
    if (winStart > winEnd) continue;
    const inWindowDays = dayDiff(winStart, winEnd) + 1;
    const isPartialFuture = !isCurrent && inWindowDays < daysInMonthOf(month);

    let monthResidual = 0;
    for (const t of targets) {
      const sched = schedOut.get(month)?.get(t.envelopeId) ?? 0;
      const actual = isCurrent ? (actualThisMonth.get(t.envelopeId) ?? 0) : 0;
      let residual = t.monthlyTargetCents - actual - sched;
      if (residual < 0) residual = 0;
      if (isPartialFuture) residual = Math.trunc((residual * inWindowDays) / daysInMonthOf(month));
      monthResidual += residual;
    }
    if (monthResidual <= 0) continue;

    if (strategy === "monthStart") {
      out.push({ date: winStart, deltaCents: -monthResidual, kind: "expected", label });
    } else if (strategy === "monthEnd") {
      out.push({ date: winEnd, deltaCents: -monthResidual, kind: "expected", label });
    } else {
      const portions = splitEvenly(monthResidual, inWindowDays);
      for (let i = 0; i < inWindowDays; i++) {
        const p = portions[i] ?? 0;
        if (p > 0)
          out.push({ date: addDays(winStart, i), deltaCents: -p, kind: "expected", label });
      }
    }
  }
  return out;
}

/** PURE event-stepping core: start balance + dated signed events → running-balance series. */
export function runningBalance(
  startingBalanceCents: number,
  startDate: string,
  endDate: string,
  horizonDays: number,
  includeExpected: boolean,
  events: readonly ForecastEvent[],
): Forecast {
  // Conservative same-day ordering: most-negative delta first, so the intraday min is the honest
  // "could I bounce?" floor. (date asc, then deltaCents asc.)
  const sorted = [...events].sort((x, y) =>
    x.date < y.date ? -1 : x.date > y.date ? 1 : x.deltaCents - y.deltaCents,
  );

  let balance = startingBalanceCents;
  let minBalanceCents = startingBalanceCents;
  let minBalanceDate = startDate;
  let firstNegativeDate: string | null = startingBalanceCents < 0 ? startDate : null;
  const points: ForecastPoint[] = [];

  for (const e of sorted) {
    balance += e.deltaCents;
    points.push({ ...e, balanceCents: balance });
    if (balance < minBalanceCents) {
      minBalanceCents = balance;
      minBalanceDate = e.date;
    }
    if (firstNegativeDate === null && balance < 0) firstNegativeDate = e.date;
  }

  return {
    startDate,
    endDate,
    horizonDays,
    includeExpected,
    startingBalanceCents,
    points,
    endingBalanceCents: balance,
    minBalanceCents,
    minBalanceDate,
    firstNegativeDate,
  };
}

/** Top-level assembly: scheduled (+ optionally expected) events → forecast over the horizon. */
export function cashFlowForecast(
  startingBalanceCents: number,
  today: string,
  rules: readonly ForecastRule[],
  targets: readonly ForecastTarget[],
  actualThisMonth: ActualSpendThisMonth,
  opts: ForecastOptions,
): Forecast {
  const horizonDays = clampHorizon(opts.horizonDays);
  const endDate = addDays(today, horizonDays);
  const events = scheduledEvents(rules, today, endDate);
  if (opts.includeExpected) {
    events.push(
      ...expectedSpendEvents(
        targets,
        rules,
        actualThisMonth,
        today,
        endDate,
        opts.strategy ?? "evenDaily",
      ),
    );
  }
  return runningBalance(
    startingBalanceCents,
    today,
    endDate,
    horizonDays,
    opts.includeExpected,
    events,
  );
}
