/** A name collides with an existing account/envelope (case-insensitive, per household). */
export class DuplicateNameError extends Error {}

/** The requested entity does not exist (in this household). */
export class NotFoundError extends Error {}
