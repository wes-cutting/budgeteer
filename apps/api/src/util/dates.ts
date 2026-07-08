// Date/time helpers shared across the API's service + HTTP layers. Pure conversions over
// string/Date row values (UTC components only, no timezone library) — kept in one place so the
// services don't each re-derive them.

/**
 * The clock is I/O (ARCHITECTURE §1): nothing below the composition root may reach for the
 * ambient wall clock. `buildServer` resolves a Clock once (callers may inject a fixed one —
 * tests do). `todayStr` REQUIRES the clock rather than defaulting it, so a new call site can't
 * silently regress to calendar-dependent behavior (EH7).
 *
 * TIMEZONE POLICY (EH8, 04_DOMAIN_MODEL §6): calendar dates ("today", "this month",
 * `occurred_on`) are USER-LOCAL — the client derives them and every user-facing date/month
 * parameter is required at the HTTP boundary. The server clock exists only for operational
 * stamps (the backup filename) and tests; it must never derive a user-facing calendar date.
 */
export type Clock = () => Date;

/** The real wall clock — referenced only at composition roots (`buildServer`'s default). */
export const systemClock: Clock = () => new Date();

/** The clock's date as a 'YYYY-MM-DD' string (UTC) — operational stamps only, per the policy above. */
export const todayStr = (clock: Clock): string => clock().toISOString().slice(0, 10);

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
