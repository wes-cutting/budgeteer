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
const get = (url: string) => ctx.app.inject({ method: "GET", url });

// Anchor everything relative to the server's notion of "today" (UTC), so the projection is
// deterministic whatever date the suite runs on.
const TODAY = new Date().toISOString().slice(0, 10);
const plus = (n: number): string => {
  const [y, m, d] = TODAY.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
};

async function makeAccount(name = "Checking", startingBalance = "0"): Promise<string> {
  return (await post("/accounts", { name, kind: "checking", startingBalance })).json().account
    .id as string;
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
  return post("/recurring", body);
}

interface ForecastPoint {
  date: string;
  deltaCents: number;
  balanceCents: number;
  kind: "scheduled" | "expected";
  label: string;
}
interface Forecast {
  accountId: string;
  accountName: string;
  startDate: string;
  endDate: string;
  horizonDays: number;
  includeExpected: boolean;
  startingBalanceCents: number;
  points: ForecastPoint[];
  endingBalanceCents: number;
  minBalanceCents: number;
  minBalanceDate: string;
  firstNegativeDate: string | null;
}
async function forecast(qs: string): Promise<Forecast> {
  return (await get(`/analysis/cash-flow-forecast${qs}`)).json().forecast as Forecast;
}

describe("analysis — cash-flow forecast (FEAT-013)", () => {
  test("projects the derived balance forward over scheduled events; min + first-negative are exact", async () => {
    const acct = await makeAccount("Checking", "1000.00"); // derived start = 100000
    const rentEnv = await makeEnvelope("Rent");
    const salaryEnv = await makeEnvelope("Salary");
    // Rent −$1,500 at +5 days; Paycheck +$2,000 at +10 days. Monthly anchors → exactly one each
    // inside a 20-day horizon (the next occurrence is ~a month out).
    await makeRule({
      accountId: acct,
      kind: "withdrawal",
      amount: "1500.00",
      frequency: "monthly",
      anchorOn: plus(5),
      payee: "Rent",
      lines: [{ envelopeId: rentEnv, amount: "1500.00" }],
    });
    await makeRule({
      accountId: acct,
      kind: "deposit",
      amount: "2000.00",
      frequency: "monthly",
      anchorOn: plus(10),
      payee: "Paycheck",
      lines: [{ envelopeId: salaryEnv, amount: "2000.00" }],
    });

    const f = await forecast(`?accountId=${acct}&horizonDays=20&includeExpected=false`);
    expect(f.accountName).toBe("Checking");
    expect(f.startingBalanceCents).toBe(100000);
    expect(f.startDate).toBe(TODAY);
    expect(f.endDate).toBe(plus(20));
    expect(f.points.map((p) => [p.date, p.deltaCents, p.balanceCents])).toEqual([
      [plus(5), -150000, -50000], // rent dips below zero
      [plus(10), 200000, 150000], // paycheck recovers
    ]);
    expect(f.minBalanceCents).toBe(-50000);
    expect(f.minBalanceDate).toBe(plus(5));
    expect(f.firstNegativeDate).toBe(plus(5));
    expect(f.endingBalanceCents).toBe(150000);
    expect(f.points.every((p) => p.kind === "scheduled")).toBe(true);
  });

  test("includeExpected folds in discretionary spend from targets — only ever lowering the balance", async () => {
    const acct = await makeAccount("Checking", "1000.00");
    const groceries = await makeEnvelope("Groceries");
    await put(`/envelopes/${groceries}/target`, { amount: "400.00" }); // discretionary, not scheduled

    const scheduledOnly = await forecast(`?accountId=${acct}&horizonDays=60&includeExpected=false`);
    const withExpected = await forecast(`?accountId=${acct}&horizonDays=60&includeExpected=true`);

    // No rules at all → scheduled-only is flat at the starting balance.
    expect(scheduledOnly.points).toEqual([]);
    expect(scheduledOnly.endingBalanceCents).toBe(100000);
    // Expected discretionary spend (Groceries target) is folded in and lowers the ending balance.
    expect(withExpected.endingBalanceCents).toBeLessThan(scheduledOnly.endingBalanceCents);
    expect(withExpected.points.some((p) => p.kind === "expected")).toBe(true);
    expect(withExpected.points.every((p) => Number.isInteger(p.deltaCents))).toBe(true);
  });

  test("horizonDays defaults to 90", async () => {
    const acct = await makeAccount();
    const f = await forecast(`?accountId=${acct}`);
    expect(f.horizonDays).toBe(90);
    expect(f.endDate).toBe(plus(90));
  });

  test("validation: bad horizon → 400, missing accountId → 400, missing account → 404", async () => {
    const acct = await makeAccount();
    expect(
      (await get(`/analysis/cash-flow-forecast?accountId=${acct}&horizonDays=5`)).statusCode,
    ).toBe(400);
    expect(
      (await get(`/analysis/cash-flow-forecast?accountId=${acct}&horizonDays=400`)).statusCode,
    ).toBe(400);
    expect(
      (await get(`/analysis/cash-flow-forecast?accountId=${acct}&horizonDays=abc`)).statusCode,
    ).toBe(400);
    expect((await get(`/analysis/cash-flow-forecast`)).statusCode).toBe(400);
    expect(
      (await get(`/analysis/cash-flow-forecast?accountId=00000000-0000-0000-0000-000000000000`))
        .statusCode,
    ).toBe(404);
  });
});
