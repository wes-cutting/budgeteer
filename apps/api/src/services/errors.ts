/** A name collides with an existing account/envelope (case-insensitive, per household). */
export class DuplicateNameError extends Error {}

/** The requested entity does not exist (in this household). */
export class NotFoundError extends Error {}

/** Input is well-formed but violates a domain rule (over-allocation, bad envelope, …) → 400. */
export class ValidationError extends Error {}

/** Operation conflicts with the resource's current state (e.g. deleting a transfer leg via the
 *  wrong endpoint) → 409. */
export class ConflictError extends Error {}
