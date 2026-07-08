// Budget burn-down (FEAT-UX11) — the Insights area's WITHIN-MONTH pace assessment. Given a month, its
// budget target, and the outflow so far, compare "share of budget consumed" (spent ÷ target) against
// "share of the month elapsed" (a LINEAR-BURN proxy for expected spend), so a user can see whether
// they're on track BEFORE month-end — not just after (that's what budget-vs-actual already shows).
//
// Pure: `today` is passed in (no Date.now), so the pace math is unit-testable in isolation — the
// impure shell reads the month's budget-vs-actual and today's date and feeds them here. Mirrors
// forecast.ts's convention (a `today` string in, no clock read) and reuses `daysInMonth`.
//
// The linear-burn assumption (spend should track the calendar) is a deliberate V1 proxy: real spend
// is lumpy, so the elapsed fraction is a REFERENCE pace, not a prediction. A more nuanced pace (e.g.
// weighting recurring bills by their due dates) is out of scope for this slice.

import { daysInMonth } from "./recurring";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Where within-month spend sits relative to the elapsed-time pace. Never encoded by colour alone. */
export type BurndownStatus = "over-budget" | "over-pace" | "on-track";

export interface BurndownInput {
  month: string; // "YYYY-MM"
  targetCents: number; // the month's budget — must be > 0 (a burn-down needs a budget to burn down)
  spentCents: number; // outflow so far this month (>= 0 normally)
}

export interface BurndownAssessment {
  elapsedFraction: number; // 0..1 — share of `month` elapsed as of `today`
  consumedFraction: number; // spentCents ÷ targetCents (may exceed 1 when over budget)
  status: BurndownStatus;
}

/**
 * Share of `month` elapsed as of `today`: 0 before it starts, 1 once it's over, else day d of D = d/D
 * (so day 15 of a 30-day month = 0.5). Both args are validated strings; comparison is on year·month so
 * it's timezone-independent.
 */
export function monthElapsedFraction(month: string, today: string): number {
  if (!MONTH_RE.test(month)) throw new Error(`invalid month: ${month}`);
  if (!DAY_RE.test(today)) throw new Error(`invalid date: ${today}`);
  const [my, mm] = month.split("-").map(Number) as [number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const monthKey = my * 12 + mm;
  const todayKey = ty * 12 + tm;
  if (todayKey < monthKey) return 0; // the month hasn't started
  if (todayKey > monthKey) return 1; // the month is over
  return Math.min(1, td / daysInMonth(my, mm)); // partway through the current month
}

/**
 * Assess within-month pace for one budget: how much of it is consumed vs. how much of the month has
 * elapsed. `over-budget` (spent past the full target) is reported first; otherwise spending ahead of
 * the calendar is `over-pace`, and at-or-below the calendar is `on-track`.
 */
export function assessBurndown(input: BurndownInput, today: string): BurndownAssessment {
  const { month, targetCents, spentCents } = input;
  if (targetCents <= 0) throw new Error(`burn-down needs a positive target: ${targetCents}`);
  const elapsedFraction = monthElapsedFraction(month, today);
  const consumedFraction = spentCents / targetCents;
  const status: BurndownStatus =
    consumedFraction > 1
      ? "over-budget"
      : consumedFraction > elapsedFraction
        ? "over-pace"
        : "on-track";
  return { elapsedFraction, consumedFraction, status };
}
