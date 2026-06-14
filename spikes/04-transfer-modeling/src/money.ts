// THROWAWAY spike code (SPIKE-04). Branded integer cents — a trimmed copy of the proven
// money core (SPIKE-02 / packages/domain). Exact integer math is already retired risk; it is
// here only so the model below type-checks and stays float-free.

export type Cents = number & { readonly __brand: "Cents" };

export function cents(n: number): Cents {
  if (!Number.isInteger(n)) throw new Error(`non-integer cents: ${n}`);
  return n as Cents;
}

export const sum = (xs: readonly number[]): Cents => cents(xs.reduce((a, b) => a + b, 0));
