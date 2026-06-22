import { describe, expect, test } from "vitest";
import { type NetWorthFlow, netWorthOverTime } from "../src/networth";

describe("netWorthOverTime", () => {
  test("empty input → a zero report with an empty trend", () => {
    expect(netWorthOverTime([])).toEqual({
      trend: [],
      assetsCents: 0,
      liabilitiesCents: 0,
      netCents: 0,
    });
  });

  test("net = assets + liabilities; liabilities carried signed (negative)", () => {
    const flows: NetWorthFlow[] = [
      { period: "2026-01", kind: "checking", netCents: 100000 }, // +$1,000 asset
      { period: "2026-01", kind: "credit", netCents: -30000 }, // owe $300 (negative balance)
    ];
    const r = netWorthOverTime(flows);
    expect(r).toMatchObject({ assetsCents: 100000, liabilitiesCents: -30000, netCents: 70000 });
    expect(r.trend).toEqual([
      { period: "2026-01", assetsCents: 100000, liabilitiesCents: -30000, netCents: 70000 },
    ]);
  });

  test("all liability kinds (credit + loan) sum into the liabilities side", () => {
    const r = netWorthOverTime([
      { period: "2026-01", kind: "credit", netCents: -20000 },
      { period: "2026-01", kind: "loan", netCents: -750000 },
      { period: "2026-01", kind: "savings", netCents: 500000 },
      { period: "2026-01", kind: "cash", netCents: 5000 },
      { period: "2026-01", kind: "other", netCents: 1000 },
    ]);
    // assets = savings + cash + other; liabilities = credit + loan.
    expect(r).toMatchObject({
      assetsCents: 506000,
      liabilitiesCents: -770000,
      netCents: -264000,
    });
  });

  test("trend cumulates ascending flows into period-end balances; final point = headline", () => {
    const r = netWorthOverTime([
      { period: "2026-01", kind: "checking", netCents: 100000 }, // open +$1,000
      { period: "2026-02", kind: "credit", netCents: -20000 }, // spend $200 on the card
      { period: "2026-03", kind: "checking", netCents: 50000 }, // deposit +$500
    ]);
    expect(r.trend).toEqual([
      { period: "2026-01", assetsCents: 100000, liabilitiesCents: 0, netCents: 100000 },
      { period: "2026-02", assetsCents: 100000, liabilitiesCents: -20000, netCents: 80000 },
      { period: "2026-03", assetsCents: 150000, liabilitiesCents: -20000, netCents: 130000 },
    ]);
    // Invariant: the final trend point reconciles to the headline current values.
    expect(r.trend.at(-1)).toMatchObject({
      assetsCents: r.assetsCents,
      liabilitiesCents: r.liabilitiesCents,
      netCents: r.netCents,
    });
  });

  test("a loan paydown (positive flow on a liability) raises net worth over time", () => {
    const r = netWorthOverTime([
      { period: "2026-01", kind: "loan", netCents: -100000 }, // owe $1,000
      { period: "2026-02", kind: "loan", netCents: 40000 }, // pay $400 → owe $600
    ]);
    expect(r.trend).toEqual([
      { period: "2026-01", assetsCents: 0, liabilitiesCents: -100000, netCents: -100000 },
      { period: "2026-02", assetsCents: 0, liabilitiesCents: -60000, netCents: -60000 },
    ]);
  });

  test("flows arrive in any order and multiple kinds per period are bucketed", () => {
    const r = netWorthOverTime([
      { period: "2026-02", kind: "savings", netCents: 30000 },
      { period: "2026-01", kind: "checking", netCents: 100000 },
      { period: "2026-01", kind: "savings", netCents: 50000 },
      { period: "2026-02", kind: "credit", netCents: -10000 },
    ]);
    expect(r.trend.map((p) => p.period)).toEqual(["2026-01", "2026-02"]); // sorted ascending
    expect(r.trend[0]).toMatchObject({
      assetsCents: 150000,
      liabilitiesCents: 0,
      netCents: 150000,
    });
    expect(r.trend[1]).toMatchObject({
      assetsCents: 180000,
      liabilitiesCents: -10000,
      netCents: 170000,
    });
  });

  test("net worth can be negative when liabilities exceed assets", () => {
    const r = netWorthOverTime([
      { period: "2026-01", kind: "checking", netCents: 50000 },
      { period: "2026-01", kind: "loan", netCents: -200000 },
    ]);
    expect(r.netCents).toBe(-150000);
  });
});
