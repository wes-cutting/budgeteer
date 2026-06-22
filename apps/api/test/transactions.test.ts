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
const put = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "PUT", url, payload: body });
const del = (url: string) => ctx.app.inject({ method: "DELETE", url });
const get = (url: string) => ctx.app.inject({ method: "GET", url });

async function makeEnvelope(name: string): Promise<string> {
  return (await post("/envelopes", { name })).json().envelope.id as string;
}
async function seed(startingBalance = "0") {
  const account = (
    await post("/accounts", { name: "Checking", kind: "checking", startingBalance })
  ).json().account;
  const env = {
    Rent: await makeEnvelope("Rent"),
    Groceries: await makeEnvelope("Groceries"),
    Savings: await makeEnvelope("Savings"),
    Gas: await makeEnvelope("Gas"),
  };
  return { accountId: account.id as string, env };
}

const balanceOf = async (collection: "accounts" | "envelopes", id: string): Promise<number> => {
  const items = (await get(`/${collection}`)).json()[collection];
  return items.find((x: { id: string }) => x.id === id).balanceCents;
};

describe("transactions & allocation API (FEAT-003)", () => {
  test("deposit with a partial split: remainder is exact and shows in needs-allocation", async () => {
    const { accountId, env } = await seed();
    const res = await post(`/accounts/${accountId}/transactions`, {
      kind: "deposit",
      amount: "3200.00",
      payee: "Employer",
      allocations: [
        { envelopeId: env.Rent, amount: "1400.00" },
        { envelopeId: env.Groceries, amount: "600.00" },
      ],
    });
    expect(res.statusCode).toBe(201);
    const txn = res.json().transaction;
    expect(txn.amountCents).toBe(320000);
    expect(txn.allocatedCents).toBe(200000);
    expect(txn.unallocatedCents).toBe(120000);

    expect(await balanceOf("accounts", accountId)).toBe(320000);
    expect(await balanceOf("envelopes", env.Rent)).toBe(140000);

    const needs = (await get("/transactions/needs-allocation")).json().transactions;
    expect(needs.some((t: { id: string }) => t.id === txn.id)).toBe(true);
  });

  test("allocate-later (PUT) completes the split and leaves the needs list", async () => {
    const { accountId, env } = await seed();
    const txn = (
      await post(`/accounts/${accountId}/transactions`, {
        kind: "deposit",
        amount: "3200.00",
        allocations: [{ envelopeId: env.Rent, amount: "1400.00" }],
      })
    ).json().transaction;

    const done = await put(`/transactions/${txn.id}/allocations`, {
      allocations: [
        { envelopeId: env.Rent, amount: "1400.00" },
        { envelopeId: env.Groceries, amount: "600.00" },
        { envelopeId: env.Savings, amount: "1200.00" },
      ],
    });
    expect(done.statusCode).toBe(200);
    expect(done.json().transaction.unallocatedCents).toBe(0);
    expect(await balanceOf("envelopes", env.Savings)).toBe(120000);

    const needs = (await get("/transactions/needs-allocation")).json().transactions;
    expect(needs.some((t: { id: string }) => t.id === txn.id)).toBe(false);
  });

  test("withdrawal fully allocated updates account and envelope balances (signed)", async () => {
    const { accountId, env } = await seed("200.00");
    const res = await post(`/accounts/${accountId}/transactions`, {
      kind: "withdrawal",
      amount: "48.20",
      payee: "Shell",
      allocations: [{ envelopeId: env.Gas, amount: "48.20" }],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().transaction.unallocatedCents).toBe(0);
    expect(await balanceOf("accounts", accountId)).toBe(20000 - 4820);
    expect(await balanceOf("envelopes", env.Gas)).toBe(-4820);
  });

  test("over-allocation, bad envelope, and non-positive amount are rejected", async () => {
    const { accountId, env } = await seed();
    expect(
      (
        await post(`/accounts/${accountId}/transactions`, {
          kind: "deposit",
          amount: "100.00",
          allocations: [{ envelopeId: env.Rent, amount: "150.00" }],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post(`/accounts/${accountId}/transactions`, {
          kind: "deposit",
          amount: "100.00",
          allocations: [{ envelopeId: "00000000-0000-0000-0000-0000000000aa", amount: "50.00" }],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await post(`/accounts/${accountId}/transactions`, { kind: "deposit", amount: "0" }))
        .statusCode,
    ).toBe(400);
  });

  test("missing account → 404 (create & list); missing transaction → 404 (allocate)", async () => {
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    expect(
      (await post(`/accounts/${ghost}/transactions`, { kind: "deposit", amount: "10.00" }))
        .statusCode,
    ).toBe(404);
    expect((await get(`/accounts/${ghost}/transactions`)).statusCode).toBe(404);
    expect((await put(`/transactions/${ghost}/allocations`, { allocations: [] })).statusCode).toBe(
      404,
    );
  });

  test("an opening balance shows up as a transaction needing allocation", async () => {
    await seed("100.00");
    const needs = (await get("/transactions/needs-allocation")).json().transactions;
    expect(needs.some((t: { kind: string }) => t.kind === "opening")).toBe(true);
  });

  test("the account register lists transactions newest-first", async () => {
    const { accountId, env } = await seed("0");
    await post(`/accounts/${accountId}/transactions`, {
      kind: "withdrawal",
      amount: "10.00",
      occurredOn: "2026-06-10",
      allocations: [{ envelopeId: env.Gas, amount: "10.00" }],
    });
    await post(`/accounts/${accountId}/transactions`, {
      kind: "deposit",
      amount: "20.00",
      occurredOn: "2026-06-12",
      allocations: [{ envelopeId: env.Rent, amount: "20.00" }],
    });
    const register = (await get(`/accounts/${accountId}/transactions`)).json().transactions;
    expect(register).toHaveLength(3); // opening(0) + two
    expect(register[0].occurredOn >= register[1].occurredOn).toBe(true);
  });

  test("editing a fully-allocated split (FEAT-005) replaces it and re-derives balances", async () => {
    const { accountId, env } = await seed();
    const txn = (
      await post(`/accounts/${accountId}/transactions`, {
        kind: "deposit",
        amount: "100.00",
        allocations: [{ envelopeId: env.Rent, amount: "100.00" }],
      })
    ).json().transaction;
    expect(txn.unallocatedCents).toBe(0);

    const upd = await put(`/transactions/${txn.id}/allocations`, {
      allocations: [
        { envelopeId: env.Rent, amount: "30.00" },
        { envelopeId: env.Groceries, amount: "70.00" },
      ],
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().transaction.unallocatedCents).toBe(0);
    expect(await balanceOf("envelopes", env.Rent)).toBe(3000);
    expect(await balanceOf("envelopes", env.Groceries)).toBe(7000);
  });

  test("allocating to an archived envelope is rejected (FEAT-006)", async () => {
    const { accountId, env } = await seed();
    await post(`/envelopes/${env.Rent}/archive`, {});
    const res = await post(`/accounts/${accountId}/transactions`, {
      kind: "deposit",
      amount: "100.00",
      allocations: [{ envelopeId: env.Rent, amount: "100.00" }],
    });
    expect(res.statusCode).toBe(400);
  });

  test("an archived envelope keeps its balance — history preserved (FEAT-006)", async () => {
    const { accountId, env } = await seed();
    await post(`/accounts/${accountId}/transactions`, {
      kind: "deposit",
      amount: "100.00",
      allocations: [{ envelopeId: env.Rent, amount: "100.00" }],
    });
    await post(`/envelopes/${env.Rent}/archive`, {});
    expect(await balanceOf("envelopes", env.Rent)).toBe(10000);
  });

  test("a refund row within a split nets to the amount and credits its envelope (FEAT-008)", async () => {
    const { accountId, env } = await seed("0");
    // A $70 receipt: $100 spent on Groceries, $30 returned to Gas (refund row).
    const res = await post(`/accounts/${accountId}/transactions`, {
      kind: "withdrawal",
      amount: "70.00",
      payee: "Store",
      allocations: [
        { envelopeId: env.Groceries, amount: "100.00" },
        { envelopeId: env.Gas, amount: "30.00", refund: true },
      ],
    });
    expect(res.statusCode).toBe(201);
    const txn = res.json().transaction;
    expect(txn.amountCents).toBe(-7000);
    expect(txn.unallocatedCents).toBe(0); // net −100 + 30 = −70
    expect(await balanceOf("accounts", accountId)).toBe(-7000);
    expect(await balanceOf("envelopes", env.Groceries)).toBe(-10000); // spent
    expect(await balanceOf("envelopes", env.Gas)).toBe(3000); // refunded (opposite sign)
  });

  test("DELETE removes a normal transaction and cascades its allocations", async () => {
    const { accountId, env } = await seed("0");
    const txn = (
      await post(`/accounts/${accountId}/transactions`, {
        kind: "deposit",
        amount: "100.00",
        allocations: [{ envelopeId: env.Rent, amount: "100.00" }],
      })
    ).json().transaction;

    expect(await balanceOf("accounts", accountId)).toBe(10000);
    expect(await balanceOf("envelopes", env.Rent)).toBe(10000);

    const res = await del(`/transactions/${txn.id}`);
    expect(res.statusCode).toBe(204);

    expect(await balanceOf("accounts", accountId)).toBe(0);
    expect(await balanceOf("envelopes", env.Rent)).toBe(0);
    const register = (await get(`/accounts/${accountId}/transactions`)).json().transactions;
    expect(register.every((t: { id: string }) => t.id !== txn.id)).toBe(true);
  });

  test("DELETE on a transfer leg → 409 (must use DELETE /transfers/:id)", async () => {
    const checking = (
      await post("/accounts", { name: "Del Checking", kind: "checking", startingBalance: "100.00" })
    ).json().account.id as string;
    const savings = (
      await post("/accounts", { name: "Del Savings", kind: "savings", startingBalance: "0" })
    ).json().account.id as string;
    const transfer = (
      await post("/transfers", { fromAccountId: checking, toAccountId: savings, amount: "50.00" })
    ).json().transfer;
    const legId = transfer.from.transactionId as string;
    const res = await del(`/transactions/${legId}`);
    expect(res.statusCode).toBe(409);
  });

  test("DELETE on unknown transaction → 404", async () => {
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    expect((await del(`/transactions/${ghost}`)).statusCode).toBe(404);
  });

  test("refunds that flip the net direction are rejected (FEAT-008)", async () => {
    const { accountId, env } = await seed("0");
    const res = await post(`/accounts/${accountId}/transactions`, {
      kind: "withdrawal",
      amount: "70.00",
      allocations: [
        { envelopeId: env.Groceries, amount: "50.00" },
        { envelopeId: env.Gas, amount: "60.00", refund: true }, // net +10 → not a withdrawal
      ],
    });
    expect(res.statusCode).toBe(400);
  });

  test("a refund row survives allocate-later / edit (PUT) (FEAT-008)", async () => {
    const { accountId, env } = await seed("0");
    const txn = (
      await post(`/accounts/${accountId}/transactions`, {
        kind: "withdrawal",
        amount: "70.00",
        allocations: [{ envelopeId: env.Groceries, amount: "70.00" }],
      })
    ).json().transaction;

    const upd = await put(`/transactions/${txn.id}/allocations`, {
      allocations: [
        { envelopeId: env.Groceries, amount: "100.00" },
        { envelopeId: env.Gas, amount: "30.00", refund: true },
      ],
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().transaction.unallocatedCents).toBe(0);
    expect(await balanceOf("envelopes", env.Gas)).toBe(3000);
  });
});
