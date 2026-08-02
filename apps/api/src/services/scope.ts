/**
 * The per-request authorization scope every service is bound to (ADR-0009 §2 · BUD-S86).
 *
 * Services filter every query by `scope.householdId`; `DEFAULT_HOUSEHOLD_ID` no longer appears in
 * the request path. Until the auth slice (BUD-S87) the scope is a hardcoded bootstrap (the single
 * seeded household, built in `buildServer`); from BUD-S87 it derives from the authenticated
 * session, and `userId`/`role` join this shape for authorization + audit.
 */
export interface Scope {
  householdId: string;
}
