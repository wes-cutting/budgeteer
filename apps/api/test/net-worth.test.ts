import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type TestApp, closeTestApp, createTestApp } from "./helpers";

let ctx: TestApp;
beforeEach(async () => {
  ctx = await createTestApp();
});
afterEach(async () => {
  await closeTestApp(ctx);
});

const post = (url: string, body?: Record<string, unknown>) =>
  ctx.app.inject({ method: "POST", url, payload: body });
const get = (url: string) => ctx.app.inject({ method: "GET", url });

async function makeAccount(name: string, kind: string, startingBalance = "0"): Promise<string> {
  return (await post("/accounts", { openedOn: "2026-07-02", name, kind, startingBalance })).json()
    .account.id as string;
}
/** A dated withdrawal/deposit with no allocation — only the account balance (= Σ txns) matters here. */
function addTxn(
  accountId: string,
  kind: "deposit" | "withdrawal",
  amount: string,
  occurredOn: string,
) {
  return post(`/accounts/${accountId}/transactions`, { kind, amount, occurredOn, allocations: [] });
}

interface NwPoint {
  period: string;
  assetsCents: number;
  liabilitiesCents: number;
  netCents: number;
}
interface NwReport {
  grain: "month" | "year";
  trend: NwPoint[];
  assetsCents: number;
  liabilitiesCents: number;
  netCents: number;
}
async function report(grain?: string): Promise<NwReport> {
  const url = grain ? `/analysis/net-worth?grain=${grain}` : "/analysis/net-worth";
  return (await get(url)).json().report as NwReport;
}
const pt = (r: NwReport, period: string): NwPoint | undefined =>
  r.trend.find((p) => p.period === period);

describe("analysis — net worth over time (FEAT-R9)", () => {
  test("net = assets + liabilities; liabilities sum in signed (negative = debt)", async () => {
    // Both opening balances land in the same month (the opening row is dated today).
    await makeAccount("Checking", "checking", "1000.00");
    await makeAccount("Visa", "credit", "-300.00"); // owes $300 → negative balance
    await makeAccount("Car loan", "loan", "-7500.00"); // owes $7,500

    const r = await report();
    expect(r.grain).toBe("month");
    expect(r.assetsCents).toBe(100000);
    expect(r.liabilitiesCents).toBe(-780000); // −(300 + 7500)
    expect(r.netCents).toBe(-680000); // 1000 − 7800
    // The headline reconciles to the final (only) trend point.
    expect(r.trend.at(-1)).toMatchObject({
      assetsCents: 100000,
      liabilitiesCents: -780000,
      netCents: -680000,
    });
  });

  test("the trend cumulates monthly flows into period-end net worth; last point = current", async () => {
    const checking = await makeAccount("Checking", "checking", "0"); // opens at $0 today
    const card = await makeAccount("Visa", "credit", "0");
    await addTxn(checking, "deposit", "1000.00", "2026-01-15"); // assets 1000 after Jan
    await addTxn(card, "withdrawal", "200.00", "2026-02-10"); // owe 200 → net 800 after Feb
    await addTxn(checking, "deposit", "500.00", "2026-03-20"); // assets 1500 → net 1300 after Mar
    await addTxn(card, "deposit", "50.00", "2026-03-25"); // pay $50 → owe 150 → net 1350 after Mar

    const r = await report();
    expect(pt(r, "2026-01")).toMatchObject({
      assetsCents: 100000,
      liabilitiesCents: 0,
      netCents: 100000,
    });
    expect(pt(r, "2026-02")).toMatchObject({
      assetsCents: 100000,
      liabilitiesCents: -20000,
      netCents: 80000,
    });
    expect(pt(r, "2026-03")).toMatchObject({
      assetsCents: 150000,
      liabilitiesCents: -15000,
      netCents: 135000,
    });
    // Invariant: the trend's final point reconciles to the headline current net worth.
    expect(r.trend.at(-1)?.netCents).toBe(r.netCents);
    expect(r.netCents).toBe(135000);
  });

  test("account↔account transfers net to zero — they neither move net worth nor double-count", async () => {
    const checking = await makeAccount("Checking", "checking", "1000.00");
    const savings = await makeAccount("Savings", "savings", "0");
    const before = await report();
    expect(before.netCents).toBe(100000);

    // Move $400 between two asset accounts: the two legs cancel in the household-wide sum.
    expect(
      (
        await post("/transfers", {
          fromAccountId: checking,
          toAccountId: savings,
          amount: "400.00",
          occurredOn: "2026-07-02",
        })
      ).statusCode,
    ).toBe(201);

    const after = await report();
    expect(after.assetsCents).toBe(100000); // unchanged
    expect(after.netCents).toBe(100000); // unchanged — the transfer is internal
  });

  test("year grain rolls months up to the year-end net worth", async () => {
    const checking = await makeAccount("Checking", "checking", "0");
    await addTxn(checking, "deposit", "1000.00", "2026-02-15");
    await addTxn(checking, "deposit", "500.00", "2026-11-15");

    const r = await report("year");
    expect(r.grain).toBe("year");
    expect(pt(r, "2026")).toMatchObject({ assetsCents: 150000, netCents: 150000 });
  });

  test("net worth is negative when liabilities exceed assets", async () => {
    await makeAccount("Checking", "checking", "500.00");
    await makeAccount("Car loan", "loan", "-2000.00");
    expect((await report()).netCents).toBe(-150000);
  });

  test("empty: no accounts/activity → a zero report with an empty trend", async () => {
    const r = await report();
    expect(r).toMatchObject({ assetsCents: 0, liabilitiesCents: 0, netCents: 0 });
    expect(r.trend).toEqual([]);
  });

  test("validation: a bad grain → 400", async () => {
    expect((await get("/analysis/net-worth?grain=week")).statusCode).toBe(400);
  });
});
