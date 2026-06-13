// THROWAWAY spike code (SPIKE-02). Proves the split-allocation domain core — including the
// partial-allocation workflow (SPIKE-01) — type-checks and is exact, with a pure core and a
// repository PORT (no I/O here), demonstrating the kit's pure-core/impure-shell boundary.

import { type Cents, cents } from "./money";

export interface Allocation {
  readonly envelopeId: string;
  readonly amount: Cents;
}

export interface Transaction {
  readonly id: string;
  readonly accountId: string;
  /** Signed: deposit > 0, withdrawal < 0. */
  readonly amount: Cents;
  readonly allocations: readonly Allocation[];
}

export function allocatedTotal(txn: Transaction): Cents {
  return cents(txn.allocations.reduce<number>((a, x) => a + x.amount, 0));
}

/** The amount still needing an envelope. 0 means fully allocated; non-zero is allowed (save now, split later). */
export function unallocated(txn: Transaction): Cents {
  return cents(txn.amount - allocatedTotal(txn));
}

export function isFullyAllocated(txn: Transaction): boolean {
  return unallocated(txn) === 0;
}

export type Validation = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Partial allocation is permitted; over-allocation is not. Allocations must share the sign of
 * the transaction and never exceed its magnitude. (Full domain rules live in 04_DOMAIN_MODEL.)
 */
export function validateAllocations(txn: Transaction): Validation {
  const allocated = allocatedTotal(txn);
  if (txn.amount >= 0) {
    if (allocated < 0) return { ok: false, reason: "deposit cannot have negative allocation total" };
    if (allocated > txn.amount) return { ok: false, reason: "over-allocated past the deposit amount" };
  } else {
    if (allocated > 0) return { ok: false, reason: "withdrawal cannot have positive allocation total" };
    if (allocated < txn.amount) return { ok: false, reason: "over-allocated past the withdrawal amount" };
  }
  return { ok: true };
}

/** A repository PORT — the impure-shell seam. The core depends on this interface, not on a DB. */
export interface TransactionRepository {
  save(txn: Transaction): Promise<void>;
  get(id: string): Promise<Transaction | undefined>;
  listNeedingAllocation(): Promise<readonly Transaction[]>;
}
