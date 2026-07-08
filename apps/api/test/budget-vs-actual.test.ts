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

async function makeAccount(name = "Checking", startingBalance = "0"): Promise<string> {
  return (
    await post("/accounts", { openedOn: "2026-07-02", name, kind: "checking", startingBalance })
  ).json().account.id as string;
}
async function makeEnvelope(name: string): Promise<string> {
  return (await post("/envelopes", { name, kind: "standard" })).json().envelope.id as string;
}
interface Alloc {
  envelopeId: string;
  amount: string;
  refund?: boolean;
}
function addTxn(
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

interface BvaRow {
  envelopeId: string;
  envelopeName: string;
  archived: boolean;
  targetCents: number | null;
  spentCents: number;
  remainingCents: number | null;
}
interface BvaReport {
  month: string;
  rows: BvaRow[];
  totalTargetCents: number;
  totalSpentCents: number;
  totalRemainingCents: number;
}
async function report(month?: string): Promise<BvaReport> {
  const q = month ? `?month=${month}` : "";
  return (await get(`/analysis/budget-vs-actual${q}`)).json().report as BvaReport;
}
const rowOf = (r: BvaReport, name: string): BvaRow | undefined =>
  r.rows.find((x) => x.envelopeName === name);

describe("analysis — budget vs. actual (FEAT-012)", () => {
  test("target vs. actual spend (outflow only): funding is excluded, remaining = target − spent", async () => {
    const acct = await makeAccount();
    const groceries = await makeEnvelope("Groceries");

    // Budget $400/mo for Groceries.
    expect((await put(`/envelopes/${groceries}/target`, { amount: "400.00" })).statusCode).toBe(
      200,
    );

    // March: fund +500 (a deposit allocation) then spend −360 (a withdrawal allocation).
    await addTxn(acct, {
      kind: "deposit",
      amount: "500.00",
      occurredOn: "2026-03-10",
      allocations: [{ envelopeId: groceries, amount: "500.00" }],
    });
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "360.00",
      occurredOn: "2026-03-20",
      allocations: [{ envelopeId: groceries, amount: "360.00" }],
    });

    const r = await report("2026-03");
    expect(r.month).toBe("2026-03");
    // Spend is the OUTFLOW only (360) — the +500 funding does not reduce it.
    expect(rowOf(r, "Groceries")).toMatchObject({
      targetCents: 40000,
      spentCents: 36000,
      remainingCents: 4000, // 400 − 360, under budget
      archived: false,
    });
    expect(r.totalTargetCents).toBe(40000);
    expect(r.totalSpentCents).toBe(36000);
    expect(r.totalRemainingCents).toBe(4000);
  });

  test("overspending shows a negative remaining", async () => {
    const acct = await makeAccount();
    const dining = await makeEnvelope("Dining");
    await put(`/envelopes/${dining}/target`, { amount: "100.00" });
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "150.00",
      occurredOn: "2026-03-05",
      allocations: [{ envelopeId: dining, amount: "150.00" }],
    });
    expect(rowOf(await report("2026-03"), "Dining")).toMatchObject({
      targetCents: 10000,
      spentCents: 15000,
      remainingCents: -5000, // over by $50
    });
  });

  test("a refund row nets down the actual spend (FEAT-008)", async () => {
    const acct = await makeAccount();
    const groceries = await makeEnvelope("Groceries");
    await put(`/envelopes/${groceries}/target`, { amount: "200.00" });
    // A −$70 withdrawal split as −$100 spend + $30 refund row ⇒ net spend $70.
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "70.00",
      occurredOn: "2026-03-12",
      allocations: [
        { envelopeId: groceries, amount: "100.00" },
        { envelopeId: groceries, amount: "30.00", refund: true },
      ],
    });
    expect(rowOf(await report("2026-03"), "Groceries")).toMatchObject({
      spentCents: 7000, // 100 spent − 30 refunded
      remainingCents: 13000,
    });
  });

  test("envelope↔envelope reallocations do not count as spend", async () => {
    const acct = await makeAccount();
    const groceries = await makeEnvelope("Groceries");
    const rent = await makeEnvelope("Rent");
    await put(`/envelopes/${groceries}/target`, { amount: "300.00" });
    await addTxn(acct, {
      kind: "deposit",
      amount: "300.00",
      occurredOn: "2026-03-01",
      allocations: [{ envelopeId: groceries, amount: "300.00" }],
    });
    expect(
      (
        await post("/envelope-transfers", {
          fromEnvelopeId: groceries,
          toEnvelopeId: rent,
          amount: "100.00",
          occurredOn: "2026-03-15",
        })
      ).statusCode,
    ).toBe(201);
    // Reallocation moved budget but is not spend; Groceries spent stays 0.
    expect(rowOf(await report("2026-03"), "Groceries")).toMatchObject({
      spentCents: 0,
      remainingCents: 30000,
    });
  });

  test("month filter: spend in another month is excluded", async () => {
    const acct = await makeAccount();
    const groceries = await makeEnvelope("Groceries");
    await put(`/envelopes/${groceries}/target`, { amount: "400.00" });
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "100.00",
      occurredOn: "2026-03-20",
      allocations: [{ envelopeId: groceries, amount: "100.00" }],
    });
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "250.00",
      occurredOn: "2026-04-20",
      allocations: [{ envelopeId: groceries, amount: "250.00" }],
    });
    expect(rowOf(await report("2026-03"), "Groceries")?.spentCents).toBe(10000);
    expect(rowOf(await report("2026-04"), "Groceries")?.spentCents).toBe(25000);
  });

  test("un-budgeted spend appears with a null target (nothing is hidden)", async () => {
    const acct = await makeAccount();
    const fun = await makeEnvelope("Fun");
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "45.00",
      occurredOn: "2026-03-09",
      allocations: [{ envelopeId: fun, amount: "45.00" }],
    });
    const row = rowOf(await report("2026-03"), "Fun");
    expect(row).toMatchObject({ targetCents: null, spentCents: 4500, remainingCents: null });
  });

  test("active envelopes always have a row (ready to set a target); empty otherwise", async () => {
    const groceries = await makeEnvelope("Groceries");
    const r = await report("2026-03");
    // No target, no spend, but active ⇒ present with a null target and zero spend.
    expect(rowOf(r, "Groceries")).toMatchObject({
      envelopeId: groceries,
      targetCents: null,
      spentCents: 0,
      remainingCents: null,
    });
    expect(r.totalTargetCents).toBe(0);
  });

  test("archived envelope appears only when it has a target or spend that month", async () => {
    const acct = await makeAccount();
    const vacation = await makeEnvelope("Vacation");
    const idle = await makeEnvelope("Idle");
    await addTxn(acct, {
      kind: "withdrawal",
      amount: "80.00",
      occurredOn: "2026-03-18",
      allocations: [{ envelopeId: vacation, amount: "80.00" }],
    });
    await post(`/envelopes/${vacation}/archive`);
    await post(`/envelopes/${idle}/archive`);

    const r = await report("2026-03");
    // Vacation: archived but had spend this month ⇒ shown, flagged.
    expect(rowOf(r, "Vacation")).toMatchObject({ archived: true, spentCents: 8000 });
    // Idle: archived, no target, no spend ⇒ omitted.
    expect(rowOf(r, "Idle")).toBeUndefined();
  });

  test("clearing a target removes it; setting replaces it", async () => {
    const groceries = await makeEnvelope("Groceries");
    await put(`/envelopes/${groceries}/target`, { amount: "400.00" });
    expect(rowOf(await report("2026-03"), "Groceries")?.targetCents).toBe(40000);
    // Replace.
    await put(`/envelopes/${groceries}/target`, { amount: "450.00" });
    expect(rowOf(await report("2026-03"), "Groceries")?.targetCents).toBe(45000);
    // Clear.
    expect((await del(`/envelopes/${groceries}/target`)).statusCode).toBe(204);
    expect(rowOf(await report("2026-03"), "Groceries")?.targetCents).toBeNull();
    // Clearing an already-absent target is idempotent.
    expect((await del(`/envelopes/${groceries}/target`)).statusCode).toBe(204);
  });

  test("a missing month is rejected — the caller supplies its local month (EH8)", async () => {
    expect((await get("/analysis/budget-vs-actual")).statusCode).toBe(400);
  });

  test("validation: bad month → 400; target on a missing envelope → 404; bad amount → 400", async () => {
    expect((await get("/analysis/budget-vs-actual?month=2026-13")).statusCode).toBe(400);
    expect((await get("/analysis/budget-vs-actual?month=nope")).statusCode).toBe(400);
    expect(
      (await put(`/envelopes/00000000-0000-0000-0000-000000000000/target`, { amount: "10.00" }))
        .statusCode,
    ).toBe(404);
    const groceries = await makeEnvelope("Groceries");
    expect((await put(`/envelopes/${groceries}/target`, { amount: "0" })).statusCode).toBe(400);
    expect((await put(`/envelopes/${groceries}/target`, { amount: "-5" })).statusCode).toBe(400);
    expect((await put(`/envelopes/${groceries}/target`, { amount: "abc" })).statusCode).toBe(400);
  });
});
