import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type TestApp, closeTestApp, createTestApp } from "./helpers";

let ctx: TestApp;
beforeEach(async () => {
  ctx = await createTestApp();
});
afterEach(async () => {
  await closeTestApp(ctx);
});

const post = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "POST", url, payload: body });
const get = (url: string) => ctx.app.inject({ method: "GET", url });
const put = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "PUT", url, payload: body });

describe("GET /envelopes/:id/ledger (R15)", () => {
  test("empty envelope returns 200 with empty rows", async () => {
    const env = (await post("/envelopes", { name: "Groceries" })).json().envelope;
    const res = await get(`/envelopes/${env.id}/ledger`);
    expect(res.statusCode).toBe(200);
    expect(res.json().rows).toHaveLength(0);
  });

  test("rows newest-first; deposit amount positive, withdrawal amount negative", async () => {
    const acct = (
      await post("/accounts", { name: "Checking", kind: "checking", startingBalance: "500.00" })
    ).json().account;
    const env = (await post("/envelopes", { name: "Groceries" })).json().envelope;

    await post(`/accounts/${acct.id}/transactions`, {
      kind: "withdrawal",
      amount: "100.00",
      occurredOn: "2026-06-01",
      payee: "Trader Joe's",
      allocations: [{ envelopeId: env.id, amount: "100.00" }],
    });
    await post(`/accounts/${acct.id}/transactions`, {
      kind: "deposit",
      amount: "200.00",
      occurredOn: "2026-06-15",
      payee: "Paycheck",
      allocations: [{ envelopeId: env.id, amount: "200.00" }],
    });

    const { rows } = (await get(`/envelopes/${env.id}/ledger`)).json();
    expect(rows).toHaveLength(2);
    expect(rows[0].occurredOn).toBe("2026-06-15");
    expect(rows[0].amountCents).toBe(20000);
    expect(rows[0].payee).toBe("Paycheck");
    expect(rows[0].accountName).toBe("Checking");
    expect(rows[1].occurredOn).toBe("2026-06-01");
    expect(rows[1].amountCents).toBe(-10000);
    expect(rows[1].payee).toBe("Trader Joe's");
  });

  test("opening-kind rows are included", async () => {
    const acct = (
      await post("/accounts", { name: "Savings", kind: "savings", startingBalance: "500.00" })
    ).json().account;
    const env = (await post("/envelopes", { name: "Emergency" })).json().envelope;

    const txns = (await get(`/accounts/${acct.id}/transactions`)).json().transactions;
    const opening = txns.find((t: { kind: string }) => t.kind === "opening");
    await put(`/transactions/${opening.id}/allocations`, {
      allocations: [{ envelopeId: env.id, amount: "500.00" }],
    });

    const { rows } = (await get(`/envelopes/${env.id}/ledger`)).json();
    expect(rows).toHaveLength(1);
    expect(rows[0].transactionKind).toBe("opening");
    expect(rows[0].amountCents).toBe(50000);
  });

  test("ledger only returns allocations for the requested envelope", async () => {
    const acct = (
      await post("/accounts", { name: "Checking", kind: "checking", startingBalance: "0" })
    ).json().account;
    const env1 = (await post("/envelopes", { name: "Groceries" })).json().envelope;
    const env2 = (await post("/envelopes", { name: "Gas" })).json().envelope;

    await post(`/accounts/${acct.id}/transactions`, {
      kind: "withdrawal",
      amount: "100.00",
      payee: "Store",
      allocations: [
        { envelopeId: env1.id, amount: "60.00" },
        { envelopeId: env2.id, amount: "40.00" },
      ],
    });

    const rows1 = (await get(`/envelopes/${env1.id}/ledger`)).json().rows;
    const rows2 = (await get(`/envelopes/${env2.id}/ledger`)).json().rows;
    expect(rows1).toHaveLength(1);
    expect(rows1[0].amountCents).toBe(-6000);
    expect(rows2).toHaveLength(1);
    expect(rows2[0].amountCents).toBe(-4000);
  });

  test("missing or wrong-household envelope id → 404", async () => {
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    const res = await get(`/envelopes/${ghost}/ledger`);
    expect(res.statusCode).toBe(404);
  });
});
