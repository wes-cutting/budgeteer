// Recurring-transaction scheduling (FEAT-009). Pure date math over 'YYYY-MM-DD' strings — no
// I/O, no timezones (UTC components only) — so the "what's due" decision is unit-testable. The
// generator itself (writing transactions) lives in the impure shell; this only computes WHEN.

export const RECURRING_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export function isRecurringFrequency(x: string): x is RecurringFrequency {
  return (RECURRING_FREQUENCIES as readonly string[]).includes(x);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number): string => String(n).padStart(2, "0");
const fmt = (y: number, m: number, d: number): string => `${y}-${pad(m)}-${pad(d)}`;

/** Days in a 1-based month (day 0 of the next month = the last day of this one). */
export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function parse(dateStr: string): { y: number; m: number; d: number } {
  if (!DATE_RE.test(dateStr)) throw new Error(`invalid date: ${dateStr}`);
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

/** The day-of-month an interval anchors on (so monthly steps preserve e.g. the 31st). */
export function anchorDayOf(dateStr: string): number {
  return parse(dateStr).d;
}

/**
 * The next occurrence strictly after `current`. Weekly/biweekly add 7/14 days. Monthly advances
 * one calendar month and lands on `anchorDay`, clamped to the month's length — and it clamps
 * from the ANCHOR day (not the previous, possibly-clamped day), so 31 → 28 (Feb) → 31 (Mar).
 */
export function nextOccurrence(
  current: string,
  frequency: RecurringFrequency,
  anchorDay: number,
): string {
  const { y, m, d } = parse(current);
  if (frequency === "weekly" || frequency === "biweekly") {
    const ms = Date.UTC(y, m - 1, d) + (frequency === "weekly" ? 7 : 14) * 24 * 60 * 60 * 1000;
    const dt = new Date(ms);
    return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  // monthly
  let nm = m + 1;
  let ny = y;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  return fmt(ny, nm, Math.min(anchorDay, daysInMonth(ny, nm)));
}

/** A safety cap so a long-dormant rule can't loop forever (≈ 5 years of weekly catch-up). */
const MAX_CATCHUP = 600;

/**
 * Every occurrence due on or before `today`, starting at the rule's `cursor` (its stored
 * next-occurrence date), plus the new cursor (the first occurrence after `today`). Idempotent
 * by construction: persist `nextCursor` and re-running posts nothing already posted.
 */
export function dueOccurrences(
  cursor: string,
  today: string,
  frequency: RecurringFrequency,
  anchorDay: number,
): { dates: string[]; nextCursor: string } {
  const dates: string[] = [];
  let cur = cursor;
  let guard = 0;
  while (cur <= today && guard < MAX_CATCHUP) {
    dates.push(cur);
    cur = nextOccurrence(cur, frequency, anchorDay);
    guard += 1;
  }
  return { dates, nextCursor: cur };
}
