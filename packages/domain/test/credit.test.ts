import { describe, expect, test } from "vitest";
import { type CreditAccountInput, creditUtilization, utilizationBps } from "../src/credit";

describe("utilizationBps", () => {
  test("owed/limit in basis points, rounded", () => {
    expect(utilizationBps(150000, 500000)).toBe(3000); // 30.00%
    expect(utilizationBps(12345, 100000)).toBe(1235); // 12.345% → 12.35% (rounded)
  });

  test("floors the numerator at 0 (a credit balance reads as 0%), never negative", () => {
    expect(utilizationBps(-20000, 500000)).toBe(0);
    expect(utilizationBps(0, 500000)).toBe(0);
  });

  test("does not clamp above 100% — over-limit is meaningful", () => {
    expect(utilizationBps(600000, 500000)).toBe(12000); // 120.00%
  });

  test("null/non-positive limit → null", () => {
    expect(utilizationBps(150000, null)).toBeNull();
    expect(utilizationBps(150000, 0)).toBeNull();
  });
});

describe("creditUtilization", () => {
  const acct = (over: Partial<CreditAccountInput>): CreditAccountInput => ({
    accountId: "a1",
    accountName: "Visa",
    archived: false,
    balanceCents: 0,
    limitCents: null,
    flows: [],
    ...over,
  });

  test("owed = −balance; available = limit − owed", () => {
    const r = creditUtilization([acct({ balanceCents: -150000, limitCents: 500000 })]);
    const a = r.accounts[0];
    expect(a).toMatchObject({ owedCents: 150000, utilizationBps: 3000, availableCents: 350000 });
  });

  test("trend cumulates ascending flows into period-end owed/utilization", () => {
    const r = creditUtilization([
      acct({
        balanceCents: -60000,
        limitCents: 100000,
        flows: [
          { period: "2026-01", netCents: -20000 },
          { period: "2026-02", netCents: -30000 },
          { period: "2026-03", netCents: -10000 },
        ],
      }),
    ]);
    const trend = r.accounts[0]?.trend ?? [];
    expect(trend).toEqual([
      { period: "2026-01", owedCents: 20000, utilizationBps: 2000 },
      { period: "2026-02", owedCents: 50000, utilizationBps: 5000 },
      { period: "2026-03", owedCents: 60000, utilizationBps: 6000 },
    ]);
    // The final trend point reconciles to the headline current owed.
    expect(trend.at(-1)?.owedCents).toBe(r.accounts[0]?.owedCents);
  });

  test("a payment (positive flow) lowers owed in the trend", () => {
    const r = creditUtilization([
      acct({
        balanceCents: -30000,
        limitCents: 100000,
        flows: [
          { period: "2026-01", netCents: -50000 }, // owe 500
          { period: "2026-02", netCents: 20000 }, // pay 200 → owe 300
        ],
      }),
    ]);
    expect(r.accounts[0]?.trend).toEqual([
      { period: "2026-01", owedCents: 50000, utilizationBps: 5000 },
      { period: "2026-02", owedCents: 30000, utilizationBps: 3000 },
    ]);
  });

  test("roll-up sums owed (floored at 0 per account) and limit only over limited accounts", () => {
    const r = creditUtilization([
      acct({ accountId: "a1", accountName: "Visa", balanceCents: -150000, limitCents: 500000 }),
      acct({ accountId: "a2", accountName: "Amex", balanceCents: 20000, limitCents: 500000 }), // overpaid → 0 owed
      acct({ accountId: "a3", accountName: "Store", balanceCents: -200000, limitCents: null }), // no limit → excluded
    ]);
    expect(r.totalOwedCents).toBe(150000); // 1500 + max(0,−200) + (excluded)
    expect(r.totalLimitCents).toBe(1000000);
    expect(r.utilizationBps).toBe(1500); // 1500/10000 = 15.00%
  });

  test("no limited accounts → null aggregate; empty input → empty report", () => {
    expect(creditUtilization([acct({ limitCents: null })]).utilizationBps).toBeNull();
    expect(creditUtilization([])).toEqual({
      accounts: [],
      totalOwedCents: 0,
      totalLimitCents: 0,
      utilizationBps: null,
    });
  });

  test("an account with no limit still reports owed and a trend, but null utilization", () => {
    const r = creditUtilization([
      acct({
        balanceCents: -30000,
        limitCents: null,
        flows: [{ period: "2026-01", netCents: -30000 }],
      }),
    ]);
    expect(r.accounts[0]).toMatchObject({
      owedCents: 30000,
      utilizationBps: null,
      availableCents: null,
    });
    expect(r.accounts[0]?.trend).toEqual([
      { period: "2026-01", owedCents: 30000, utilizationBps: null },
    ]);
  });
});
