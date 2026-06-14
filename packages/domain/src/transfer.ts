import { type Cents, cents } from "./money";

/**
 * Account↔account transfer (double-entry), per SPIKE-04 / ADR-0004. A transfer is two linked
 * transactions of `kind: "transfer"`: −magnitude out of the source account, +magnitude into the
 * destination. The legs sum to zero (money is conserved, only relocated) and carry NO
 * allocations — relocated money is already budgeted, so transfer legs are EXEMPT from the
 * needs-allocation surface. Envelope balances are untouched (the orthogonal axis is #7b).
 */

export interface TransferLeg {
  readonly accountId: string;
  /** Signed: −magnitude on the source leg, +magnitude on the destination leg. */
  readonly amountCents: Cents;
}

export type TransferValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * Pure transfer rules: a positive magnitude between two distinct accounts. Account existence
 * and archived-state are enforced at the data boundary (they need I/O), not here.
 */
export function validateTransfer(
  fromAccountId: string,
  toAccountId: string,
  magnitudeCents: number,
): TransferValidation {
  if (!Number.isInteger(magnitudeCents) || magnitudeCents <= 0) {
    return { ok: false, reason: "Enter a transfer amount greater than 0." };
  }
  if (fromAccountId === toAccountId) {
    return { ok: false, reason: "Choose two different accounts." };
  }
  return { ok: true };
}

/** The two signed legs of a double-entry account transfer (−magnitude out, +magnitude in). */
export function transferLegs(
  fromAccountId: string,
  toAccountId: string,
  magnitudeCents: Cents,
): readonly [TransferLeg, TransferLeg] {
  return [
    { accountId: fromAccountId, amountCents: cents(-magnitudeCents) },
    { accountId: toAccountId, amountCents: cents(magnitudeCents) },
  ];
}
