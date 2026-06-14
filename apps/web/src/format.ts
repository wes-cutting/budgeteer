/** Format integer cents for display, e.g. 214000 -> "$2,140.00", -41200 -> "-$412.00". */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  const remainder = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}$${dollars}.${remainder}`;
}
