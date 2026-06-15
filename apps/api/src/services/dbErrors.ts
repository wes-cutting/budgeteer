import { DuplicateNameError } from "./errors";

/** Postgres SQLSTATE for a unique-constraint violation (PGlite emits the same code). */
const UNIQUE_VIOLATION = "23505";

/**
 * True when an error is a unique-constraint violation from the database. The DB unique index on
 * `(household_id, lower(btrim(name)))` is the *real* name guard: it backstops the in-app
 * `nameExists` check and is the only guard under a concurrent insert the check can't see.
 */
export function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/**
 * Run a DB write, translating a unique-constraint violation into a `DuplicateNameError` (which the
 * HTTP layer maps to 409) instead of letting the raw Postgres error surface as a 500. The in-app
 * `nameExists` check returns the same error for the common case; this covers the concurrent-insert
 * race it can't. Any other error propagates unchanged. Keeping this in the service layer (which
 * owns DB access) keeps the HTTP layer free of datastore concerns.
 */
export async function asDuplicateName<T>(message: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e) {
    if (isUniqueViolation(e)) throw new DuplicateNameError(message);
    throw e;
  }
}
