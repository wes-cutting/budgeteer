/**
 * V1 single implicit household (design-toward multi-household; no auth/RLS yet — ADR-0002).
 * Lives here, decoupled from the migration module, so every service can scope its queries to the
 * one household without importing from `db/migrate`. The multi-household epic (roadmap #19) is
 * where this becomes a real, request-derived value.
 */
export const DEFAULT_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000001";
