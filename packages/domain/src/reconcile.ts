import { type Cents, cents } from "./money";

/**
 * Reconcile-to-bank (FEAT-010): compare an account's DERIVED balance (the book — Σ of its
 * transactions) against the real STATEMENT balance the user reads off their bank. Manual,
 * user-driven — V1 just surfaces the difference (no per-transaction cleared concept).
 *
 * Sign convention: `differenceCents = statement − derived`.
 *   • `> 0` → the bank shows MORE than Budgeteer (likely un-entered deposits).
 *   • `< 0` → the bank shows LESS than Budgeteer (likely un-entered withdrawals).
 *   • `0`  → matched.
 */
export interface ReconciliationDelta {
  readonly differenceCents: Cents;
  readonly matched: boolean;
}

export function reconciliationDelta(
  derivedCents: number,
  statementCents: number,
): ReconciliationDelta {
  const differenceCents = cents(statementCents - derivedCents);
  return { differenceCents, matched: differenceCents === 0 };
}
