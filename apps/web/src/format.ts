/** Format integer cents for display, e.g. 214000 -> "$2,140.00", -41200 -> "-$412.00". */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  const remainder = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}$${dollars}.${remainder}`;
}

/** Format integer cents as a plain decimal for an input value, e.g. 140000 -> "1400.00". */
export function centsToInput(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}

/**
 * Split a total into n parts, distributing the leftover cents so the parts sum to the total
 * EXACTLY (parts differ by at most 1 cent). Used by "distribute remaining". Mirrors SPIKE-02.
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

const MONEY_RE = /^-?\d+(\.\d{1,2})?$/;

/** Parse a decimal string to integer cents for the live tally; null if not valid money. */
export function parseCents(input: string): number | null {
  const s = input.trim();
  if (!MONEY_RE.test(s)) return null;
  const negative = s.startsWith("-");
  const [whole = "0", frac = ""] = s.replace("-", "").split(".");
  const total = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return negative ? -total : total;
}
