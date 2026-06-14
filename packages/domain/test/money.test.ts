import { describe, expect, test } from "vitest";
import { addMoney, cents, formatMoney, negate, parseMoney, sumMoney } from "../src/money";

describe("money — integer minor units (ADR-0003)", () => {
  test("parse/format round-trips at the boundary", () => {
    expect(parseMoney("3200.00")).toBe(320000);
    expect(parseMoney("-31.25")).toBe(-3125);
    expect(parseMoney("0.07")).toBe(7);
    expect(parseMoney("5")).toBe(500);
    expect(formatMoney(cents(320000))).toBe("3200.00");
    expect(formatMoney(cents(7))).toBe("0.07");
    expect(formatMoney(cents(-3125))).toBe("-31.25");
  });

  test("the classic float trap is exact", () => {
    expect(sumMoney([parseMoney("0.10"), parseMoney("0.20")])).toBe(parseMoney("0.30"));
  });

  test("invalid money input fails loudly", () => {
    for (const bad of ["12.345", "1,234.00", "abc", "", "$5", "1.2.3"]) {
      expect(() => parseMoney(bad)).toThrow(/Invalid money input/);
    }
    expect(() => cents(33.5)).toThrow(/whole cents/);
  });

  test("add and negate stay integer-exact", () => {
    expect(addMoney(parseMoney("19.99"), parseMoney("0.01"))).toBe(2000);
    expect(negate(parseMoney("12.34"))).toBe(-1234);
  });
});
