// COPIED VERBATIM from packages/domain/src/recurring.ts (proven by FEAT-009, 106 tests) so the
// spike's projection rides on the REAL schedule math without a workspace dependency. The only
// thing the forecast does differently is feed dueOccurrences a FUTURE horizon date as the bound
// (instead of `today`) — the loop condition is just `cur <= bound`, so that enumerates future
// occurrences with no change. The spike proves that holds.

export const RECURRING_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number): string => String(n).padStart(2, "0");
const fmt = (y: number, m: number, d: number): string => `${y}-${pad(m)}-${pad(d)}`;

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function parse(dateStr: string): { y: number; m: number; d: number } {
  if (!DATE_RE.test(dateStr)) throw new Error(`invalid date: ${dateStr}`);
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

export function anchorDayOf(dateStr: string): number {
  return parse(dateStr).d;
}

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
  let nm = m + 1;
  let ny = y;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  return fmt(ny, nm, Math.min(anchorDay, daysInMonth(ny, nm)));
}

const MAX_CATCHUP = 600;

export function dueOccurrences(
  cursor: string,
  bound: string,
  frequency: RecurringFrequency,
  anchorDay: number,
): { dates: string[]; nextCursor: string } {
  const dates: string[] = [];
  let cur = cursor;
  let guard = 0;
  while (cur <= bound && guard < MAX_CATCHUP) {
    dates.push(cur);
    cur = nextOccurrence(cur, frequency, anchorDay);
    guard += 1;
  }
  return { dates, nextCursor: cur };
}

// --- small date helpers the forecast needs (throwaway; the slice will reuse util/dates) ---

export const monthOf = (dateStr: string): string => dateStr.slice(0, 7);

export function addDays(dateStr: string, n: number): string {
  const { y, m, d } = parse(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d) + n * 24 * 60 * 60 * 1000);
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function daysInMonthOf(month: string): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return daysInMonth(y, m);
}
