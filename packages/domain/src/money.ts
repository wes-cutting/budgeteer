// Money — integer minor units (US cents), per ADR-0003. No floating point for any stored or
// returned amount; parse/format only at the boundary. Validated in TS by SPIKE-02.

/** A signed monetary amount in integer minor units (cents). Branded to prevent raw-number mixups. */
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
 * Boundary-only: validates external input loudly. Floats never enter the core.
 */
export function parseMoney(input: string): Cents {
  const s = input.trim();
  if (!DECIMAL_RE.test(s)) throw new Error(`Invalid money input: "${input}"`);
  const negative = s.startsWith("-");
  const [whole = "0", frac = ""] = s.replace("-", "").split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  const total = Number(whole) * 100 + Number(fracPadded);
  return cents(negative ? -total : total);
}

/** Format integer cents to a plain decimal string ("1234" -> "12.34"). Boundary-only. */
export function formatMoney(value: Cents): string {
  const negative = value < 0;
  const abs = Math.abs(value);
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

export function negate(value: Cents): Cents {
  return cents(-value);
}

export const ZERO = cents(0);
