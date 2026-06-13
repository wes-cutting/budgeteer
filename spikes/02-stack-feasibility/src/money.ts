// THROWAWAY spike code (SPIKE-02). Proves ADR-0003 (integer minor units) is exact & clean
// in TypeScript. All amounts are signed integer **cents**. Positive = inflow, negative =
// outflow. No floating point is ever used for a stored/returned amount.

/** A monetary amount in integer minor units (US cents). Branded to stop raw-number mixups. */
export type Cents = number & { readonly __brand: "Cents" };

/** Construct Cents, enforcing the whole-integer invariant at the seam. */
export function cents(n: number): Cents {
  if (!Number.isInteger(n)) {
    throw new Error(`Money must be whole cents, got non-integer: ${n}`);
  }
  return n as Cents;
}

const DECIMAL_RE = /^-?\d+(\.\d{1,2})?$/;

/**
 * Parse a user-entered decimal string ("12.34", "-5", "0.07") into integer cents.
 * Boundary-only (validate external input loudly, per the spine). Floats never enter the core.
 */
export function parseMoney(input: string): Cents {
  const s = input.trim();
  if (!DECIMAL_RE.test(s)) throw new Error(`Invalid money input: "${input}"`);
  const negative = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  const total = Number(whole) * 100 + Number(fracPadded);
  return cents(negative ? -total : total);
}

/** Format integer cents to a decimal string for display. Boundary-only. */
export function formatMoney(c: Cents): string {
  const negative = c < 0;
  const abs = Math.abs(c);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${negative ? "-" : ""}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

/** Exact integer sum. */
export function sumMoney(xs: readonly Cents[]): Cents {
  return cents(xs.reduce<number>((a, b) => a + b, 0));
}

export function addMoney(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function negate(c: Cents): Cents {
  return cents(-c);
}

/**
 * Split a total into `n` even parts, distributing the leftover cents so the parts sum to
 * the total EXACTLY (parts differ by at most 1 cent). Models "distribute evenly".
 */
export function splitEvenly(total: Cents, n: number): Cents[] {
  if (!Number.isInteger(n) || n < 1) throw new Error(`n must be a positive integer, got ${n}`);
  const base = Math.trunc(total / n);
  let leftover = total - base * n; // signed; magnitude < n
  const step = leftover >= 0 ? 1 : -1;
  const parts: Cents[] = [];
  for (let i = 0; i < n; i++) {
    let part = base;
    if (leftover !== 0) {
      part += step;
      leftover -= step;
    }
    parts.push(cents(part));
  }
  return parts;
}

/**
 * Split a total across weighted buckets (e.g. a percentage paycheck template), using the
 * largest-remainder method so the parts sum to the total EXACTLY. Weights are relative.
 */
export function splitByWeights(total: Cents, weights: readonly number[]): Cents[] {
  const W = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || W <= 0) throw new Error("weights must be non-empty and sum to > 0");
  const exact = weights.map((w) => (total * w) / W); // float used ONLY to rank remainders
  const parts = exact.map((x) => Math.trunc(x));
  let leftover = total - parts.reduce((a, b) => a + b, 0);
  const byFractionDesc = exact
    .map((x, i) => ({ i, frac: Math.abs(x - Math.trunc(x)) }))
    .sort((a, b) => b.frac - a.frac)
    .map((o) => o.i);
  const step = leftover >= 0 ? 1 : -1;
  let k = 0;
  while (leftover !== 0) {
    const idx = byFractionDesc[k % byFractionDesc.length]!;
    parts[idx] += step;
    leftover -= step;
    k++;
  }
  return parts.map(cents);
}

/**
 * The "last row takes the remainder" rule from SPIKE-01: given a total and the amounts the
 * user typed for all-but-one row, compute the final row so the split sums to the total EXACTLY.
 */
export function lastRowRemainder(total: Cents, knownParts: readonly Cents[]): Cents {
  const known = knownParts.reduce<number>((a, b) => a + b, 0);
  return cents(total - known);
}
