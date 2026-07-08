// Local calendar-date derivation (EH8, 04_DOMAIN_MODEL §6): "today" and "this month" are the
// USER'S local calendar dates, derived here from the browser's clock — never via
// `toISOString()`, which is UTC and shifts a day/month early for users west of UTC from
// evening on. The server derives no user-facing calendar date; every screen that needs one
// takes it from these helpers and passes it explicitly.

const pad = (n: number): string => String(n).padStart(2, "0");

/** Today as a local 'YYYY-MM-DD' string. */
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The current local month as 'YYYY-MM'. */
export function localMonth(): string {
  return localToday().slice(0, 7);
}

/** First/last day of the current local calendar month as 'YYYY-MM-DD' — the register's
 *  default window (R8). */
export function localMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const lastDay = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(lastDay)}` };
}
