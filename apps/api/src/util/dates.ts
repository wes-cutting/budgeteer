// Date/time helpers shared across the API's service + HTTP layers. Pure conversions over
// string/Date row values (UTC components only, no timezone library) — kept in one place so the
// services don't each re-derive them.

/** Today as a 'YYYY-MM-DD' string (UTC). */
export const todayStr = (): string => new Date().toISOString().slice(0, 10);

/**
 * The first and last calendar day of the month containing today (UTC), as 'YYYY-MM-DD'
 * strings — the default window for the account register (R8). Computed here so the HTTP
 * boundary doesn't re-derive month arithmetic.
 */
export const currentMonthRange = (): { from: string; to: string } => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const pad = (n: number): string => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(lastDay)}` };
};

/**
 * A nullable timestamp column → a full ISO-8601 string (e.g. `archivedAt`), or null. Accepts a
 * `Date` or a string row value (node-postgres returns `Date`; PGlite may return a string).
 */
export const toISO = (d: Date | string | null): string | null =>
  d == null ? null : d instanceof Date ? d.toISOString() : new Date(d).toISOString();

/**
 * A DB date/timestamp value → a 'YYYY-MM-DD' calendar string. Handles both string and `Date` row
 * shapes (node-postgres vs PGlite) without pulling in a timezone.
 */
export const toDateStr = (v: unknown): string =>
  typeof v === "string"
    ? v.slice(0, 10)
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : String(v);
