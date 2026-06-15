// Date/time helpers shared across the API's service + HTTP layers. Pure conversions over
// string/Date row values (UTC components only, no timezone library) — kept in one place so the
// services don't each re-derive them.

/** Today as a 'YYYY-MM-DD' string (UTC). */
export const todayStr = (): string => new Date().toISOString().slice(0, 10);

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
