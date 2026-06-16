// Money — integer minor units (US cents), per ADR-0003. No floating point for any stored or
// returned amount; parse/format only at the boundary. Validated in TS by SPIKE-02.

/**
 * A signed monetary amount in integer minor units (cents). Branded to prevent raw-number mixups.
 *
 * Accepted-as-is (review 2026-06-15, EH6): cents ride a JS `number`, which represents integers
 * exactly only up to `Number.MAX_SAFE_INTEGER` (2^53−1 ≈ 9.0e15 cents ≈ **$90 trillion**). Postgres
 * stores amounts as `bigint`, and the API narrows them back with `Number(...)` at the read boundary
 * — exact within that ceiling, which is far beyond any V1 balance. Amounts past ~$90T are out of
 * scope (would need bigint end-to-end).
 */
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
 * Parse a user-entered decimal string ("12.34", "-5", "0.07") into integer cents, or `null`
 * when it isn't valid money. The single home for the penny-exact parse regex (DECIMAL_RE), so
 * the UI's live-tally parser and the loud boundary parser can never drift apart. Floats never
 * enter the core. Use this where partial/typing-in-progress input is expected; use `parseMoney`
 * at a hard boundary that must reject loudly.
 */
export function tryParseMoney(input: string): Cents | null {
  const s = input.trim();
  if (!DECIMAL_RE.test(s)) return null;
  const negative = s.startsWith("-");
  const [whole = "0", frac = ""] = s.replace("-", "").split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  const total = Number(whole) * 100 + Number(fracPadded);
  return cents(negative ? -total : total);
}

/**
 * Parse a user-entered decimal string into integer cents, throwing on invalid input.
 * Boundary-only: validates external input loudly. Delegates to `tryParseMoney`.
 */
export function parseMoney(input: string): Cents {
  const parsed = tryParseMoney(input);
  if (parsed === null) throw new Error(`Invalid money input: "${input}"`);
  return parsed;
}

/**
 * Format integer cents to a plain decimal string ("1234" -> "12.34"). Accepts `Cents` or a
 * plain integer-cents `number` (e.g. an `amountCents` deserialized from the wire), since this is
 * a pure read — the brand is enforced where money is constructed/parsed, not where it's shown.
 */
export function formatMoney(value: number): string {
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

/**
 * Split a total into `n` parts, distributing the leftover cents so the parts sum to the total
 * EXACTLY (parts differ by at most 1 cent). Used by the UI's "distribute remaining". Pure integer
 * arithmetic over integer-cents `number`s (matches SPIKE-02). Returns `[]` for `n < 1`.
 */
export function splitEvenly(totalCents: number, n: number): number[] {
  if (n < 1) return [];
  const base = Math.trunc(totalCents / n);
  let leftover = totalCents - base * n;
  const step = leftover >= 0 ? 1 : -1;
  const parts: number[] = [];
  for (let i = 0; i < n; i++) {
    let part = base;
    if (leftover !== 0) {
      part += step;
      leftover -= step;
    }
    parts.push(part);
  }
  return parts;
}
