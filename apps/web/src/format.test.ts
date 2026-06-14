import { describe, expect, test } from "vitest";
import { centsToInput, formatCents, parseCents, splitEvenly } from "./format";

describe("format helpers", () => {
  test("splitEvenly distributes the leftover so parts sum EXACTLY", () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(100, 3).reduce((a, b) => a + b, 0)).toBe(100);
    expect(splitEvenly(120000, 7).reduce((a, b) => a + b, 0)).toBe(120000);
    expect(splitEvenly(-21400, 3).reduce((a, b) => a + b, 0)).toBe(-21400);
    expect(splitEvenly(0, 3)).toEqual([0, 0, 0]);
    expect(splitEvenly(50, 0)).toEqual([]);
  });

  test("money parse/format round-trips", () => {
    expect(parseCents("12.34")).toBe(1234);
    expect(parseCents("1,234")).toBeNull();
    expect(centsToInput(140000)).toBe("1400.00");
    expect(formatCents(214000)).toBe("$2,140.00");
    expect(formatCents(-41200)).toBe("-$412.00");
  });
});
