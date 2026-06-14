import { type Cents, cents } from "./money";

export interface Allocation {
  readonly id: string;
  readonly transactionId: string;
  readonly envelopeId: string;
  /** Signed: shares the sign of its transaction. Integer cents (ADR-0003). */
  readonly amountCents: Cents;
}

type HasAmount = Pick<Allocation, "amountCents">;

export function allocatedTotal(allocations: readonly HasAmount[]): Cents {
  return cents(allocations.reduce<number>((a, x) => a + x.amountCents, 0));
}

/** The part of a transaction not yet assigned to an envelope. Non-zero is allowed (split later). */
export function unallocated(amount: Cents, allocations: readonly HasAmount[]): Cents {
  return cents(amount - allocatedTotal(allocations));
}

export function isFullyAllocated(amount: Cents, allocations: readonly HasAmount[]): boolean {
  return unallocated(amount, allocations) === 0;
}

export type AllocationValidation = { ok: true } | { ok: false; reason: string };

/**
 * The split invariant: partial allocation is allowed; over-allocation is rejected; every
 * allocation must share the transaction's sign.
 */
export function validateAllocations(
  amount: Cents,
  allocations: readonly HasAmount[],
): AllocationValidation {
  const total = allocatedTotal(allocations);
  if (amount >= 0) {
    if (total < 0)
      return { ok: false, reason: "A deposit cannot have a negative allocation total." };
    if (total > amount) return { ok: false, reason: "Allocations exceed the deposit amount." };
  } else {
    if (total > 0)
      return { ok: false, reason: "A withdrawal cannot have a positive allocation total." };
    if (total < amount) return { ok: false, reason: "Allocations exceed the withdrawal amount." };
  }
  return { ok: true };
}

/** Derived envelope balance = sum of the allocation amounts landing in it. */
export function envelopeBalance(allocations: readonly HasAmount[]): Cents {
  return allocatedTotal(allocations);
}
