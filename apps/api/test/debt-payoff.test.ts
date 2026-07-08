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

interface PayoffPoint {
  period: string;
  owedCents: number;
  payoffBps: number | null;
}
interface PayoffAccount {
  accountId: string;
  accountName: string;
  archived: boolean;
  originalPrincipalCents: number | null;
  owedCents: number;
  paidDownCents: number | null;
  payoffBps: number | null;
  trend: PayoffPoint[];
}
interface PayoffReport {
  accounts: PayoffAccount[];
  totalOriginalCents: number;
  totalOwedCents: number;
  totalPaidDownCents: number;
  payoffBps: number | null;
}
async function report(): Promise<PayoffReport> {
  return (await get("/analysis/debt-payoff")).json().report as PayoffReport;
}
const acctOf = (r: PayoffReport, name: string): PayoffAccount | undefined =>
  r.accounts.find((a) => a.accountName === name);

describe("analysis — debt payoff (FEAT-014b)", () => {
  test("owed = −balance; payoff = 1 − owed/original; paid-down = original − owed", async () => {
    // A car loan with $10,000 original, currently owing $7,500 (a negative balance).
    const loan = await makeAccount("Car loan", "loan", "-7500.00");
    expect(
      (await put(`/accounts/${loan}/original-principal`, { amount: "10000.00" })).statusCode,
    ).toBe(200);

    expect(acctOf(await report(), "Car loan")).toMatchObject({
      originalPrincipalCents: 1000000,
      owedCents: 750000,
      paidDownCents: 250000, // 10000 − 7500
      payoffBps: 2500, // (1 − 7500/10000) = 25.0%
      archived: false,
    });
  });

  test("a brand-new loan reads 0%; a settled loan reads 100%", async () => {
    const fresh = await makeAccount("Fresh loan", "loan", "-10000.00"); // owe the full principal
    const settled = await makeAccount("Settled loan", "loan", "0"); // balance 0 = nothing owed
    await put(`/accounts/${fresh}/original-principal`, { amount: "10000.00" });
    await put(`/accounts/${settled}/original-principal`, { amount: "10000.00" });

    const r = await report();
    expect(acctOf(r, "Fresh loan")).toMatchObject({ owedCents: 1000000, payoffBps: 0 });
    expect(acctOf(r, "Settled loan")).toMatchObject({ owedCents: 0, payoffBps: 10000 }); // 100.0%
  });

  test("portfolio roll-up: payoff = total paid-down ÷ total original (signed owed)", async () => {
    const car = await makeAccount("Car loan", "loan", "-5000.00"); // owe 5000 of 10000
    const student = await makeAccount("Student loan", "loan", "-15000.00"); // owe 15000 of 20000
    await makeAccount("Personal loan", "loan", "-1000.00"); // no principal → excluded from roll-up
    await put(`/accounts/${car}/original-principal`, { amount: "10000.00" });
    await put(`/accounts/${student}/original-principal`, { amount: "20000.00" });

    const r = await report();
    expect(acctOf(r, "Personal loan")).toMatchObject({ payoffBps: null, paidDownCents: null });
    // Σ original = 30000; Σ owed = 20000; paid down = 10000 → 33.33%.
    expect(r.totalOriginalCents).toBe(3000000);
    expect(r.totalOwedCents).toBe(2000000);
    expect(r.totalPaidDownCents).toBe(1000000);
    expect(r.payoffBps).toBe(3333); // round(10000/30000 × 10000)
  });

  test("overpayment reads above 100% (not clamped) with paid-down beyond the original", async () => {
    const loan = await makeAccount("Car loan", "loan", "500.00"); // overpaid: +$500 balance
    await put(`/accounts/${loan}/original-principal`, { amount: "10000.00" });
    expect(acctOf(await report(), "Car loan")).toMatchObject({
      owedCents: -50000, // a credit (overpaid)
      paidDownCents: 1050000, // 10000 − (−500)
      payoffBps: 10500, // 105.0%
    });
  });

  test("the trend cumulates monthly flows into period-end payoff; last point = current owed", async () => {
    const loan = await makeAccount("Car loan", "loan", "0"); // opens at $0 today
    await put(`/accounts/${loan}/original-principal`, { amount: "10000.00" });
    await addTxn(loan, "withdrawal", "10000.00", "2026-01-15"); // draw the loan: owe 10000
    await addTxn(loan, "deposit", "2000.00", "2026-02-15"); // pay 2000: owe 8000
    await addTxn(loan, "deposit", "3000.00", "2026-03-15"); // pay 3000: owe 5000

    const a = acctOf(await report(), "Car loan");
    const pt = (p: string) => a?.trend.find((x) => x.period === p);
    expect(pt("2026-01")).toMatchObject({ owedCents: 1000000, payoffBps: 0 }); // 0% paid
    expect(pt("2026-02")).toMatchObject({ owedCents: 800000, payoffBps: 2000 }); // 20%
    expect(pt("2026-03")).toMatchObject({ owedCents: 500000, payoffBps: 5000 }); // 50%
    // Invariant: the trend's final point reconciles to the current owed balance.
    expect(a?.trend.at(-1)?.owedCents).toBe(a?.owedCents);
    expect(a?.owedCents).toBe(500000);
  });

  test("only loan accounts are reported; other kinds are excluded", async () => {
    await makeAccount("Checking", "checking", "1000.00");
    await makeAccount("Visa", "credit", "-100.00");
    await makeAccount("Car loan", "loan", "-5000.00");
    const r = await report();
    expect(r.accounts.map((a) => a.accountName)).toEqual(["Car loan"]);
  });

  test("a loan with no original principal appears with null payoff but a real owed/trend", async () => {
    await makeAccount("Car loan", "loan", "-5000.00");
    const a = acctOf(await report(), "Car loan");
    expect(a).toMatchObject({ originalPrincipalCents: null, owedCents: 500000, payoffBps: null });
    expect(a?.paidDownCents).toBeNull();
    expect(a?.trend.length).toBeGreaterThan(0); // owed-over-time still computed
  });

  test("set replaces, clear removes (idempotent); a principal on a non-loan account is rejected", async () => {
    const loan = await makeAccount("Car loan", "loan", "-8000.00");
    await put(`/accounts/${loan}/original-principal`, { amount: "10000.00" });
    expect(acctOf(await report(), "Car loan")?.originalPrincipalCents).toBe(1000000);
    // Replace.
    await put(`/accounts/${loan}/original-principal`, { amount: "12000.00" });
    expect(acctOf(await report(), "Car loan")?.originalPrincipalCents).toBe(1200000);
    // Clear (204), and clearing again is idempotent.
    expect((await del(`/accounts/${loan}/original-principal`)).statusCode).toBe(204);
    expect(acctOf(await report(), "Car loan")?.originalPrincipalCents).toBeNull();
    expect((await del(`/accounts/${loan}/original-principal`)).statusCode).toBe(204);

    // A principal on a credit account is a category error → 400.
    const card = await makeAccount("Visa", "credit", "0");
    expect(
      (await put(`/accounts/${card}/original-principal`, { amount: "1000.00" })).statusCode,
    ).toBe(400);
  });

  test("validation: bad amount → 400; missing account → 404", async () => {
    const loan = await makeAccount("Car loan", "loan", "0");
    expect((await put(`/accounts/${loan}/original-principal`, { amount: "0" })).statusCode).toBe(
      400,
    );
    expect((await put(`/accounts/${loan}/original-principal`, { amount: "-5" })).statusCode).toBe(
      400,
    );
    expect((await put(`/accounts/${loan}/original-principal`, { amount: "abc" })).statusCode).toBe(
      400,
    );
    expect(
      (
        await put(`/accounts/00000000-0000-0000-0000-000000000000/original-principal`, {
          amount: "10.00",
        })
      ).statusCode,
    ).toBe(404);
  });

  test("empty: no loan accounts → an empty report with a null aggregate", async () => {
    await makeAccount("Checking", "checking", "500.00");
    const r = await report();
    expect(r.accounts).toEqual([]);
    expect(r).toMatchObject({
      totalOriginalCents: 0,
      totalOwedCents: 0,
      totalPaidDownCents: 0,
      payoffBps: null,
    });
  });
});
