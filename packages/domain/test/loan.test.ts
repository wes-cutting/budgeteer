import { describe, expect, test } from "vitest";
import { type LoanAccountInput, debtPayoff, payoffBps } from "../src/loan";

describe("payoffBps", () => {
  test("(1 − owed/original) in basis points, rounded", () => {
    expect(payoffBps(750000, 1000000)).toBe(2500); // 25.0% paid off
    expect(payoffBps(1000000, 1000000)).toBe(0); // brand new → 0%
    expect(payoffBps(0, 1000000)).toBe(10000); // settled → 100%
  });

  test("truthful (not clamped): overpaid > 100%, owing more than original < 0%", () => {
    expect(payoffBps(-50000, 1000000)).toBe(10500); // overpaid → 105%
    expect(payoffBps(1100000, 1000000)).toBe(-1000); // owe more than borrowed → −10%
  });

  test("null/non-positive original → null", () => {
    expect(payoffBps(750000, null)).toBeNull();
    expect(payoffBps(750000, 0)).toBeNull();
  });
});

describe("debtPayoff", () => {
  const loan = (over: Partial<LoanAccountInput>): LoanAccountInput => ({
    accountId: "l1",
    accountName: "Car loan",
    archived: false,
    balanceCents: 0,
    originalPrincipalCents: null,
    flows: [],
    ...over,
  });

  test("owed = −balance; paid-down = original − owed", () => {
    const r = debtPayoff([loan({ balanceCents: -750000, originalPrincipalCents: 1000000 })]);
    expect(r.accounts[0]).toMatchObject({
      owedCents: 750000,
      paidDownCents: 250000,
      payoffBps: 2500,
    });
  });

  test("trend cumulates ascending flows into period-end owed/payoff", () => {
    const r = debtPayoff([
      loan({
        balanceCents: -500000,
        originalPrincipalCents: 1000000,
        flows: [
          { period: "2026-01", netCents: -1000000 }, // draw: owe 10000
          { period: "2026-02", netCents: 200000 }, // pay 2000: owe 8000
          { period: "2026-03", netCents: 300000 }, // pay 3000: owe 5000
        ],
      }),
    ]);
    expect(r.accounts[0]?.trend).toEqual([
      { period: "2026-01", owedCents: 1000000, payoffBps: 0 },
      { period: "2026-02", owedCents: 800000, payoffBps: 2000 },
      { period: "2026-03", owedCents: 500000, payoffBps: 5000 },
    ]);
    // The final trend point reconciles to the headline current owed.
    expect(r.accounts[0]?.trend.at(-1)?.owedCents).toBe(r.accounts[0]?.owedCents);
  });

  test("roll-up: paid-down ÷ original over loans with an original principal", () => {
    const r = debtPayoff([
      loan({
        accountId: "l1",
        accountName: "Car",
        balanceCents: -500000,
        originalPrincipalCents: 1000000,
      }),
      loan({
        accountId: "l2",
        accountName: "Student",
        balanceCents: -1500000,
        originalPrincipalCents: 2000000,
      }),
      loan({
        accountId: "l3",
        accountName: "Personal",
        balanceCents: -100000,
        originalPrincipalCents: null,
      }), // excluded
    ]);
    expect(r.totalOriginalCents).toBe(3000000);
    expect(r.totalOwedCents).toBe(2000000);
    expect(r.totalPaidDownCents).toBe(1000000);
    expect(r.payoffBps).toBe(3333); // 10000/30000
  });

  test("no principalled loans → null aggregate; empty input → empty report", () => {
    expect(debtPayoff([loan({ originalPrincipalCents: null })]).payoffBps).toBeNull();
    expect(debtPayoff([])).toEqual({
      accounts: [],
      totalOriginalCents: 0,
      totalOwedCents: 0,
      totalPaidDownCents: 0,
      payoffBps: null,
    });
  });

  test("a loan with no original still reports owed and a trend, but null payoff", () => {
    const r = debtPayoff([
      loan({
        balanceCents: -500000,
        originalPrincipalCents: null,
        flows: [{ period: "2026-01", netCents: -500000 }],
      }),
    ]);
    expect(r.accounts[0]).toMatchObject({
      owedCents: 500000,
      payoffBps: null,
      paidDownCents: null,
    });
    expect(r.accounts[0]?.trend).toEqual([
      { period: "2026-01", owedCents: 500000, payoffBps: null },
    ]);
  });
});
