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
const put = (url: string, body?: Record<string, unknown>) =>
  ctx.app.inject({ method: "PUT", url, payload: body });
const del = (url: string) => ctx.app.inject({ method: "DELETE", url });
const get = (url: string) => ctx.app.inject({ method: "GET", url });

async function makeAccount(name: string, kind: string, startingBalance = "0"): Promise<string> {
  return (await post("/accounts", { name, kind, startingBalance })).json().account.id as string;
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

interface CuPoint {
  period: string;
  owedCents: number;
  utilizationBps: number | null;
}
interface CuAccount {
  accountId: string;
  accountName: string;
  archived: boolean;
  limitCents: number | null;
  owedCents: number;
  availableCents: number | null;
  utilizationBps: number | null;
  trend: CuPoint[];
}
interface CuReport {
  accounts: CuAccount[];
  totalOwedCents: number;
  totalLimitCents: number;
  utilizationBps: number | null;
}
async function report(): Promise<CuReport> {
  return (await get("/analysis/credit-utilization")).json().report as CuReport;
}
const acctOf = (r: CuReport, name: string): CuAccount | undefined =>
  r.accounts.find((a) => a.accountName === name);

describe("analysis — credit utilization (FEAT-014a)", () => {
  test("owed = −balance; utilization = owed/limit in basis points; available = limit − owed", async () => {
    // Open a card already owing $1,500 (a negative opening balance), limit $5,000.
    const card = await makeAccount("Visa", "credit", "-1500.00");
    expect((await put(`/accounts/${card}/credit-limit`, { amount: "5000.00" })).statusCode).toBe(
      200,
    );

    const a = acctOf(await report(), "Visa");
    expect(a).toMatchObject({
      limitCents: 500000,
      owedCents: 150000, // −(−150000)
      utilizationBps: 3000, // 1500/5000 = 30.00%
      availableCents: 350000, // 5000 − 1500
      archived: false,
    });
  });

  test("portfolio roll-up sums owed and limit only over accounts that have a limit", async () => {
    const visa = await makeAccount("Visa", "credit", "-1500.00");
    const amex = await makeAccount("Amex", "credit", "-500.00");
    await makeAccount("Store card", "credit", "-200.00"); // no limit → excluded from the roll-up
    await put(`/accounts/${visa}/credit-limit`, { amount: "5000.00" });
    await put(`/accounts/${amex}/credit-limit`, { amount: "5000.00" });
    // `Store card` has no limit → excluded from the roll-up, utilization null.

    const r = await report();
    expect(acctOf(r, "Store card")).toMatchObject({ utilizationBps: null, availableCents: null });
    // Σ owed over limited accounts = 1500 + 500 = 2000; Σ limit = 10000 → 20.00%.
    expect(r.totalOwedCents).toBe(200000);
    expect(r.totalLimitCents).toBe(1000000);
    expect(r.utilizationBps).toBe(2000);
  });

  test("over-limit reads above 100% (not clamped) with a negative available", async () => {
    const card = await makeAccount("Visa", "credit", "-6000.00");
    await put(`/accounts/${card}/credit-limit`, { amount: "5000.00" });
    expect(acctOf(await report(), "Visa")).toMatchObject({
      owedCents: 600000,
      utilizationBps: 12000, // 120.00%
      availableCents: -100000, // over by $1,000
    });
  });

  test("a credit balance (overpayment) reads as 0% used, never negative", async () => {
    const card = await makeAccount("Visa", "credit", "200.00"); // +$200 credit balance
    await put(`/accounts/${card}/credit-limit`, { amount: "5000.00" });
    const a = acctOf(await report(), "Visa");
    expect(a?.owedCents).toBe(-20000); // owed is signed (negative = a credit balance)
    expect(a?.utilizationBps).toBe(0); // floored at 0, not negative
    expect(a?.availableCents).toBe(520000); // 5000 − (−200)
    // Roll-up floors per-account owed at 0 too, so an overpaid card contributes 0 owed.
    const r = await report();
    expect(r.totalOwedCents).toBe(0);
    expect(r.utilizationBps).toBe(0);
  });

  test("the trend cumulates monthly flows into period-end utilization; last point = current owed", async () => {
    const card = await makeAccount("Visa", "credit", "0"); // opens at $0 today
    await put(`/accounts/${card}/credit-limit`, { amount: "1000.00" });
    await addTxn(card, "withdrawal", "200.00", "2026-01-15"); // owe 200 after Jan
    await addTxn(card, "withdrawal", "300.00", "2026-02-15"); // owe 500 after Feb
    await addTxn(card, "withdrawal", "100.00", "2026-03-15"); // owe 600 after Mar

    const a = acctOf(await report(), "Visa");
    const pt = (p: string) => a?.trend.find((x) => x.period === p);
    expect(pt("2026-01")).toMatchObject({ owedCents: 20000, utilizationBps: 2000 }); // 20%
    expect(pt("2026-02")).toMatchObject({ owedCents: 50000, utilizationBps: 5000 }); // 50%
    expect(pt("2026-03")).toMatchObject({ owedCents: 60000, utilizationBps: 6000 }); // 60%
    // Invariant: the trend's final point reconciles to the current owed balance.
    expect(a?.trend.at(-1)?.owedCents).toBe(a?.owedCents);
    expect(a?.owedCents).toBe(60000);
  });

  test("only credit accounts are reported; other kinds are excluded", async () => {
    await makeAccount("Checking", "checking", "1000.00");
    await makeAccount("Visa", "credit", "-100.00");
    const r = await report();
    expect(r.accounts.map((a) => a.accountName)).toEqual(["Visa"]);
  });

  test("a credit account with no limit appears with null utilization but a real owed/trend", async () => {
    await makeAccount("Visa", "credit", "-300.00");
    const a = acctOf(await report(), "Visa");
    expect(a).toMatchObject({ limitCents: null, owedCents: 30000, utilizationBps: null });
    expect(a?.availableCents).toBeNull();
    expect(a?.trend.length).toBeGreaterThan(0); // owed-over-time still computed
  });

  test("set replaces, clear removes (idempotent); a limit on a non-credit account is rejected", async () => {
    const card = await makeAccount("Visa", "credit", "-1000.00");
    await put(`/accounts/${card}/credit-limit`, { amount: "2000.00" });
    expect(acctOf(await report(), "Visa")?.limitCents).toBe(200000);
    // Replace.
    await put(`/accounts/${card}/credit-limit`, { amount: "2500.00" });
    expect(acctOf(await report(), "Visa")?.limitCents).toBe(250000);
    // Clear (204), and clearing again is idempotent.
    expect((await del(`/accounts/${card}/credit-limit`)).statusCode).toBe(204);
    expect(acctOf(await report(), "Visa")?.limitCents).toBeNull();
    expect((await del(`/accounts/${card}/credit-limit`)).statusCode).toBe(204);

    // A limit on a checking account is a category error → 400.
    const checking = await makeAccount("Checking", "checking", "0");
    expect(
      (await put(`/accounts/${checking}/credit-limit`, { amount: "1000.00" })).statusCode,
    ).toBe(400);
  });

  test("validation: bad amount → 400; missing account → 404", async () => {
    const card = await makeAccount("Visa", "credit", "0");
    expect((await put(`/accounts/${card}/credit-limit`, { amount: "0" })).statusCode).toBe(400);
    expect((await put(`/accounts/${card}/credit-limit`, { amount: "-5" })).statusCode).toBe(400);
    expect((await put(`/accounts/${card}/credit-limit`, { amount: "abc" })).statusCode).toBe(400);
    expect(
      (
        await put(`/accounts/00000000-0000-0000-0000-000000000000/credit-limit`, {
          amount: "10.00",
        })
      ).statusCode,
    ).toBe(404);
  });

  test("empty: no credit accounts → an empty report with a null aggregate", async () => {
    await makeAccount("Checking", "checking", "500.00");
    const r = await report();
    expect(r.accounts).toEqual([]);
    expect(r).toMatchObject({ totalOwedCents: 0, totalLimitCents: 0, utilizationBps: null });
  });
});
