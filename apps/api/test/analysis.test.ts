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
const put = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "PUT", url, payload: body });
const get = (url: string) => ctx.app.inject({ method: "GET", url });

async function makeAccount(name = "Checking", startingBalance = "0"): Promise<string> {
  return (await post("/accounts", { name, kind: "checking", startingBalance })).json().account
    .id as string;
}
async function makeEnvelope(name: string): Promise<string> {
  return (await post("/envelopes", { name, kind: "standard" })).json().envelope.id as string;
}
interface Alloc {
  envelopeId: string;
  amount: string;
}
async function addTxn(
  accountId: string,
  body: {
    kind: "deposit" | "withdrawal";
    amount: string;
    occurredOn: string;
    allocations: Alloc[];
  },
) {
  return post(`/accounts/${accountId}/transactions`, body);
}

interface SpendRow {
  envelopeId: string;
  envelopeName: string;
  archived: boolean;
  amounts: number[];
  total: number;
}
interface Rollup {
  grain: string;
  periods: string[];
  rows: SpendRow[];
  periodTotals: number[];
  grandTotal: number;
}
async function rollup(grain?: string): Promise<Rollup> {
  const q = grain ? `?grain=${grain}` : "";
  return (await get(`/analysis/envelope-spend${q}`)).json().rollup as Rollup;
}
const rowOf = (r: Rollup, name: string): SpendRow | undefined =>
  r.rows.find((x) => x.envelopeName === name);

describe("analysis — spend by envelope over time (FEAT-011)", () => {
  test("monthly grid: net signed flow per envelope × month, with row/column/grand totals", async () => {
    const acct = await makeAccount();
    const groceries = await makeEnvelope("Groceries");
    const rent = await makeEnvelope("Rent");
    const vacation = await makeEnvelope("Vacation");

    // March 2026: fund 1000 (split 500/300/200), spend 560 from Groceries + 300 from Rent.
    await addTxn(acct, {
      kind: "deposit",
      amount: "1000.00",
      occurredOn: "2026-03-15",
      allocations: [
        { envelopeId: groceries, amount: "500.00" },
        { envelopeId: rent, amount: "300.00" },
        { envelopeId: vacation, amount: "200.00" },
      ],
    });
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "560.00",
      occurredOn: "2026-03-20",
      allocations: [{ envelopeId: groceries, amount: "560.00" }],
    });
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "300.00",
      occurredOn: "2026-03-25",
      allocations: [{ envelopeId: rent, amount: "300.00" }],
    });
    // April 2026: same shape, a touch more grocery spend.
    await addTxn(acct, {
      kind: "deposit",
      amount: "1000.00",
      occurredOn: "2026-04-15",
      allocations: [
        { envelopeId: groceries, amount: "500.00" },
        { envelopeId: rent, amount: "300.00" },
        { envelopeId: vacation, amount: "200.00" },
      ],
    });
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "580.00",
      occurredOn: "2026-04-18",
      allocations: [{ envelopeId: groceries, amount: "580.00" }],
    });
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "300.00",
      occurredOn: "2026-04-25",
      allocations: [{ envelopeId: rent, amount: "300.00" }],
    });
    // Archive Vacation AFTER its allocations — history must still appear in the rollup.
    expect((await post(`/envelopes/${vacation}/archive`)).statusCode).toBe(200);

    const r = await rollup("month");
    expect(r.grain).toBe("month");
    expect(r.periods).toEqual(["2026-03", "2026-04"]);
    expect(r.rows.map((x) => x.envelopeName)).toEqual(["Groceries", "Rent", "Vacation"]);

    // Groceries: Mar +500−560 = −60; Apr +500−580 = −80; row total −140.
    expect(rowOf(r, "Groceries")).toMatchObject({
      amounts: [-6000, -8000],
      total: -14000,
      archived: false,
    });
    // Rent: funded == spent each month ⇒ a row of zeros, still shown (it HAD flow).
    expect(rowOf(r, "Rent")).toMatchObject({ amounts: [0, 0], total: 0 });
    // Vacation: archived, but its +200/+200 history is preserved.
    expect(rowOf(r, "Vacation")).toMatchObject({
      amounts: [20000, 20000],
      total: 40000,
      archived: true,
    });

    expect(r.periodTotals).toEqual([14000, 12000]); // column sums
    expect(r.grandTotal).toBe(26000); // == Σ periodTotals == Σ row totals
  });

  test("annual rollup collapses months and keeps years separate", async () => {
    const acct = await makeAccount();
    const groceries = await makeEnvelope("Groceries");
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "100.00",
      occurredOn: "2025-12-15",
      allocations: [{ envelopeId: groceries, amount: "100.00" }],
    });
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "200.00",
      occurredOn: "2026-01-15",
      allocations: [{ envelopeId: groceries, amount: "200.00" }],
    });

    const byMonth = await rollup("month");
    expect(byMonth.periods).toEqual(["2025-12", "2026-01"]);

    const byYear = await rollup("year");
    expect(byYear.grain).toBe("year");
    expect(byYear.periods).toEqual(["2025", "2026"]);
    expect(rowOf(byYear, "Groceries")).toMatchObject({ amounts: [-10000, -20000], total: -30000 });
  });

  test("envelope↔envelope reallocations are excluded (real transaction flow only)", async () => {
    const acct = await makeAccount();
    const groceries = await makeEnvelope("Groceries");
    const rent = await makeEnvelope("Rent");
    await addTxn(acct, {
      kind: "deposit",
      amount: "500.00",
      occurredOn: "2026-03-15",
      allocations: [{ envelopeId: groceries, amount: "500.00" }],
    });
    // Move budget Groceries → Rent. This must NOT touch the rollup.
    expect(
      (
        await post("/envelope-transfers", {
          fromEnvelopeId: groceries,
          toEnvelopeId: rent,
          amount: "100.00",
          occurredOn: "2026-03-20",
        })
      ).statusCode,
    ).toBe(201);

    const r = await rollup("month");
    expect(r.rows.map((x) => x.envelopeName)).toEqual(["Groceries"]); // Rent has no allocations → absent
    expect(rowOf(r, "Groceries")).toMatchObject({ amounts: [50000], total: 50000 });
    expect(r.grandTotal).toBe(50000); // unchanged by the reallocation
  });

  test("opening-balance allocations are counted", async () => {
    const acct = await makeAccount("Savings", "200.00");
    const groceries = await makeEnvelope("Groceries");
    const txns = (await get(`/accounts/${acct}/transactions`)).json().transactions as {
      id: string;
      kind: string;
    }[];
    const opening = txns.find((t) => t.kind === "opening");
    expect(opening).toBeDefined();
    expect(
      (
        await put(`/transactions/${opening!.id}/allocations`, {
          allocations: [{ envelopeId: groceries, amount: "200.00" }],
        })
      ).statusCode,
    ).toBe(200);

    const r = await rollup("month");
    expect(rowOf(r, "Groceries")?.total).toBe(20000); // opening funding counted
    expect(r.grandTotal).toBe(20000);
  });

  test("empty state: no allocations ⇒ no periods, no rows", async () => {
    const r = await rollup("month");
    expect(r).toMatchObject({ periods: [], rows: [], periodTotals: [], grandTotal: 0 });
  });

  test("grain defaults to month; an unknown grain is a 400", async () => {
    expect((await get("/analysis/envelope-spend")).json().rollup.grain).toBe("month");
    expect((await get("/analysis/envelope-spend?grain=weekly")).statusCode).toBe(400);
  });
});
