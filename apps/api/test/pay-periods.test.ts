import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { PayPeriodPlanView } from "../src/contract";
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

// The caller supplies the plan's day zero (EH8) — fixtures are relative to the TODAY we send,
// so the plan is deterministic whatever date the suite runs on.
const TODAY = new Date().toISOString().slice(0, 10);
const plus = (n: number): string => {
  const [y, m, d] = TODAY.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
};

async function makeAccount(name = "Checking", startingBalance = "0"): Promise<string> {
  return (
    await post("/accounts", { openedOn: "2026-07-02", name, kind: "checking", startingBalance })
  ).json().account.id as string;
}
async function makeEnvelope(name: string): Promise<string> {
  return (await post("/envelopes", { name, kind: "standard" })).json().envelope.id as string;
}
function makeRule(body: {
  accountId: string;
  kind: "deposit" | "withdrawal";
  amount: string;
  frequency: "weekly" | "biweekly" | "monthly";
  anchorOn: string;
  payee?: string;
  lines: { envelopeId: string; amount: string }[];
}) {
  return post("/recurring", { ...body, today: TODAY });
}

async function planFor(accountId: string): Promise<PayPeriodPlanView> {
  return (await get(`/analysis/pay-periods?accountId=${accountId}&today=${TODAY}`)).json()
    .plan as PayPeriodPlanView;
}

describe("analysis — pay-period plan (FEAT-S7)", () => {
  test("expected paychecks become buckets covering the bills they fund, with commitment-time headroom", async () => {
    const acct = await makeAccount("Checking", "1000.00"); // derived start = 100000
    const salaryEnv = await makeEnvelope("Salary");
    const rentEnv = await makeEnvelope("Rent");
    // Paycheck +$2,000 at +10 days (monthly → one more at ~+40); Rent −$1,500 at +25 days:
    // cutoff +18, so the +10 check covers it with 15 days of float.
    await makeRule({
      accountId: acct,
      kind: "deposit",
      amount: "2000.00",
      frequency: "monthly",
      anchorOn: plus(10),
      payee: "Paycheck",
      lines: [{ envelopeId: salaryEnv, amount: "2000.00" }],
    });
    await makeRule({
      accountId: acct,
      kind: "withdrawal",
      amount: "1500.00",
      frequency: "monthly",
      anchorOn: plus(25),
      payee: "Rent",
      lines: [{ envelopeId: rentEnv, amount: "1500.00" }],
    });

    const plan = await planFor(acct);
    expect(plan.accountName).toBe("Checking");
    expect(plan.startDate).toBe(TODAY);
    expect(plan.horizonDays).toBe(90); // V1: fixed at the forecast default
    expect(plan.leadDays).toBe(7);
    expect(plan.startingBalanceCents).toBe(100000);

    const checks = plan.buckets.filter((b) => b.kind === "paycheck");
    expect(checks.length).toBeGreaterThanOrEqual(3); // ~90 days of monthly paychecks
    expect(checks[0]?.committedOn).toBe(plus(10));
    expect(checks[0]?.incomeCents).toBe(200000);
    expect(checks[0]?.bills).toEqual([{ label: "Rent", dueOn: plus(25), amountCents: 150000 }]);
    expect(checks[0]?.totalCents).toBe(150000);
    expect(checks[0]?.overCommitted).toBe(false);
    // Headroom after the first check: 100000 + 200000 − 150000 = 150000; never negative here.
    expect(checks[0]?.headroomAfterCents).toBe(150000);
    expect(plan.firstBreakOn).toBeNull();
    // Buckets run in commitment order.
    const order = plan.buckets.map((b) => b.committedOn);
    expect([...order].sort()).toEqual(order);

    // FEAT-UXR2 additive fields: reserve = the running per-check-headroom fold (= headroomAfter),
    // and projected balance is populated on every bucket (a cash-flow figure, ≥ 0 here).
    for (const b of plan.buckets) {
      expect(b.reserveCents).toBe(b.headroomAfterCents);
      expect(typeof b.projectedBalanceCents).toBe("number");
    }
    // reserveₙ = reserveₙ₋₁ + (incomeₙ − totalₙ) — the acceptance reconciliation.
    let prevReserve = plan.startingBalanceCents;
    for (const b of plan.buckets) {
      expect(b.reserveCents).toBe(prevReserve + (b.incomeCents - b.totalCents));
      prevReserve = b.reserveCents;
    }

    // Projected balance reconciles with the cash-flow-forecast endpoint (same account/date/horizon,
    // the forecast's evenDaily + includeExpected defaults) — read off as of each commitment date.
    const forecast = (
      await get(`/analysis/cash-flow-forecast?accountId=${acct}&today=${TODAY}`)
    ).json().forecast as {
      startingBalanceCents: number;
      points: { date: string; balanceCents: number }[];
    };
    const forecastBalanceAsOf = (date: string): number =>
      forecast.points.reduce(
        (bal, pt) => (pt.date <= date ? pt.balanceCents : bal),
        forecast.startingBalanceCents,
      );
    for (const b of plan.buckets) {
      expect(b.projectedBalanceCents).toBe(forecastBalanceAsOf(b.committedOn));
    }
  });

  test("bills due before any feasible paycheck come from the balance bucket, committed today", async () => {
    const acct = await makeAccount("Checking", "100.00");
    const env = await makeEnvelope("Utilities");
    // Bill at +3 days; no deposit rule at all → zero income, everything from the balance.
    await makeRule({
      accountId: acct,
      kind: "withdrawal",
      amount: "150.00",
      frequency: "monthly",
      anchorOn: plus(3),
      payee: "Power",
      lines: [{ envelopeId: env, amount: "150.00" }],
    });

    const plan = await planFor(acct);
    const zero = plan.buckets[0];
    expect(zero?.kind).toBe("balance");
    expect(zero?.committedOn).toBe(TODAY);
    expect(zero?.bills.map((b) => b.label)).toContain("Power");
    // 10000 − 15000 → the plan breaks at today.
    expect(zero?.headroomAfterCents).toBeLessThan(0);
    expect(plan.firstBreakOn).toBe(TODAY);
  });

  test("validation: missing accountId → 400, missing/bad today → 400, unknown account → 404", async () => {
    const acct = await makeAccount();
    expect((await get(`/analysis/pay-periods`)).statusCode).toBe(400);
    expect((await get(`/analysis/pay-periods?accountId=${acct}`)).statusCode).toBe(400);
    expect((await get(`/analysis/pay-periods?accountId=${acct}&today=07/03/2026`)).statusCode).toBe(
      400,
    );
    expect(
      (
        await get(
          `/analysis/pay-periods?accountId=00000000-0000-0000-0000-000000000000&today=${TODAY}`,
        )
      ).statusCode,
    ).toBe(404);
  });
});
