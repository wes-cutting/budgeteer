// Presentation-only money formatting for the web. The penny-exact parse/round logic and the
// plain-decimal form live once in @budgeteer/domain (tryParseMoney / formatMoney / splitEvenly);
// import those directly. This file holds only display formatting — currency symbol + locale
// grouping — which is a presentation concern, not domain logic.

/** Format integer cents for display, e.g. 214000 -> "$2,140.00", -41200 -> "-$412.00". */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  const remainder = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}$${dollars}.${remainder}`;
}

/** Format basis points for display, e.g. 3000 -> "30.0%", 12000 -> "120.0%" (FEAT-014a). */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}
