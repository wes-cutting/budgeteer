import { describe, expect, test } from "vitest";
import { formatCents } from "./format";

// Penny-exact parse (tryParseMoney), plain-decimal form (formatMoney), and even splitting
// (splitEvenly) are tested once in @budgeteer/domain. This covers only the web's display
// formatter (currency symbol + locale grouping).
describe("formatCents — display money", () => {
  test("adds the currency symbol and thousands separators", () => {
    expect(formatCents(214000)).toBe("$2,140.00");
    expect(formatCents(-41200)).toBe("-$412.00");
    expect(formatCents(7)).toBe("$0.07");
    expect(formatCents(0)).toBe("$0.00");
  });
});
