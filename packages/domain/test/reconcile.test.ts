import { describe, expect, test } from "vitest";
import { reconciliationDelta } from "../src/index";

describe("reconcile-to-bank (FEAT-010)", () => {
  test("matched when the statement equals the derived balance", () => {
    expect(reconciliationDelta(75000, 75000)).toEqual({ differenceCents: 0, matched: true });
  });

  test("positive difference when the bank shows more (un-entered deposits)", () => {
    // derived $750, bank $800 → +$50
    expect(reconciliationDelta(75000, 80000)).toEqual({ differenceCents: 5000, matched: false });
  });

  test("negative difference when the bank shows less (un-entered withdrawals)", () => {
    // derived $750, bank $730 → −$20
    expect(reconciliationDelta(75000, 73000)).toEqual({ differenceCents: -2000, matched: false });
  });

  test("works with negative balances and stays exact", () => {
    expect(reconciliationDelta(-5000, -5000).matched).toBe(true);
    expect(reconciliationDelta(-5000, -4500).differenceCents).toBe(500);
  });
});
