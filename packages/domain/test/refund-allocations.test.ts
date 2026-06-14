import { describe, expect, test } from "vitest";
import { cents, validateAllocations } from "../src/index";

// Refunds within a split (FEAT-008): allocation rows may be MIXED sign, as long as the signed
// TOTAL stays within [0, amount] in the transaction's direction. The split invariant
// (validateAllocations) was always defined on the total — these tests pin that it admits
// opposite-sign (refund) rows and still rejects a net direction flip / over-allocation.
const a = (n: number) => ({ amountCents: cents(n) });

describe("mixed-sign allocations (refunds within a split)", () => {
  test("withdrawal: a spend row + a refund row that net to the amount is fully allocated", () => {
    // −$70 receipt = $100 groceries spent − $30 returned to household
    expect(validateAllocations(cents(-7000), [a(-10000), a(3000)])).toEqual({ ok: true });
  });

  test("withdrawal: mixed rows netting to a partial (within the amount) are allowed", () => {
    // net −$20 of a −$70 withdrawal → partial, leaves a remainder
    expect(validateAllocations(cents(-7000), [a(-5000), a(3000)])).toEqual({ ok: true });
  });

  test("withdrawal: refunds that flip the net positive are rejected (enter it as a deposit)", () => {
    expect(validateAllocations(cents(-7000), [a(-5000), a(6000)]).ok).toBe(false);
  });

  test("withdrawal: a spend row exceeding the amount with no offsetting refund is rejected", () => {
    expect(validateAllocations(cents(-7000), [a(-10000)]).ok).toBe(false);
  });

  test("deposit (refund): a refund row + a small deduction netting to the amount is valid", () => {
    // +$100 refund deposit = +$120 back to groceries − $20 to fees
    expect(validateAllocations(cents(10000), [a(12000), a(-2000)])).toEqual({ ok: true });
  });

  test("deposit: rows that over-allocate the net are rejected", () => {
    expect(validateAllocations(cents(10000), [a(5000), a(7000)]).ok).toBe(false);
  });
});
