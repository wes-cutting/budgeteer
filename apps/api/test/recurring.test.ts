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
const del = (url: string) => ctx.app.inject({ method: "DELETE", url });
const get = (url: string) => ctx.app.inject({ method: "GET", url });

// Dates relative to the real "today" the server uses, so assertions don't depend on the calendar.
const isoOffset = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function makeEnvelope(name: string): Promise<string> {
  return (await post("/envelopes", { name })).json().envelope.id as string;
}
async function makeAccount(): Promise<string> {
  return (
    await post("/accounts", { name: "Checking", kind: "checking", startingBalance: "0" })
  ).json().account.id as string;
}
const balanceOf = async (collection: "accounts" | "envelopes", id: string): Promise<number> => {
  const items = (await get(`/${collection}`)).json()[collection];
  return items.find((x: { id: string }) => x.id === id).balanceCents;
};

describe("recurring transactions API (FEAT-009)", () => {
  test("create a rule → next occurrence = anchor, due count reflects the schedule", async () => {
    const accountId = await makeAccount();
    const rent = await makeEnvelope("Rent");
    const res = await post("/recurring", {
      accountId,
      kind: "withdrawal",
      amount: "1500.00",
      payee: "Landlord",
      frequency: "monthly",
      anchorOn: isoOffset(7), // future → nothing due yet
      lines: [{ envelopeId: rent, amount: "1500.00" }],
    });
    expect(res.statusCode).toBe(201);
    const rule = res.json().recurring;
    expect(rule.nextOccurrenceOn).toBe(isoOffset(7));
    expect(rule.dueCount).toBe(0);
    expect(rule.lines).toHaveLength(1);
  });

  test("post-due generates every due occurrence, sets the split, and is idempotent", async () => {
    const accountId = await makeAccount();
    const pay = await makeEnvelope("Paycheck");
    // Weekly, anchored 21 days ago → occurrences at −21, −14, −7, today = 4.
    await post("/recurring", {
      accountId,
      kind: "deposit",
      amount: "10.00",
      frequency: "weekly",
      anchorOn: isoOffset(-21),
      lines: [{ envelopeId: pay, amount: "10.00" }],
    });

    const first = await post("/recurring/post-due", {});
    expect(first.statusCode).toBe(200);
    expect(first.json().result.posted).toBe(4);
    expect(await balanceOf("accounts", accountId)).toBe(4000); // 4 × $10
    expect(await balanceOf("envelopes", pay)).toBe(4000); // fully allocated each time

    // Generated transactions are real register rows, linked to the rule.
    const register = (await get(`/accounts/${accountId}/transactions`)).json().transactions;
    expect(
      register.filter((t: { recurringId: string | null }) => t.recurringId !== null),
    ).toHaveLength(4);

    // Re-running posts nothing (cursor parked in the future).
    const second = await post("/recurring/post-due", {});
    expect(second.json().result.posted).toBe(0);
    expect(await balanceOf("accounts", accountId)).toBe(4000);

    // The rule's due count is now 0.
    const rule = (await get("/recurring")).json().recurring[0];
    expect(rule.dueCount).toBe(0);
  });

  test("a partially-allocated rule generates transactions that need allocation", async () => {
    const accountId = await makeAccount();
    const pay = await makeEnvelope("Paycheck");
    await post("/recurring", {
      accountId,
      kind: "deposit",
      amount: "100.00",
      frequency: "weekly",
      anchorOn: isoOffset(-1), // one occurrence due
      lines: [{ envelopeId: pay, amount: "60.00" }], // $40 unallocated
    });
    await post("/recurring/post-due", {});
    const needs = (await get("/transactions/needs-allocation")).json().transactions;
    expect(needs.some((t: { unallocatedCents: number }) => t.unallocatedCents === 4000)).toBe(true);
  });

  test("validation: bad frequency / missing account / no lines / over-allocated split are rejected", async () => {
    const accountId = await makeAccount();
    const rent = await makeEnvelope("Rent");
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    const base = { kind: "withdrawal", amount: "100.00", anchorOn: isoOffset(0) };

    expect(
      (
        await post("/recurring", {
          ...base,
          accountId,
          frequency: "yearly",
          lines: [{ envelopeId: rent, amount: "100.00" }],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post("/recurring", {
          ...base,
          accountId: ghost,
          frequency: "monthly",
          lines: [{ envelopeId: rent, amount: "100.00" }],
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await post("/recurring", { ...base, accountId, frequency: "monthly", lines: [] }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await post("/recurring", {
          ...base,
          accountId,
          frequency: "monthly",
          lines: [{ envelopeId: rent, amount: "150.00" }],
        })
      ).statusCode,
    ).toBe(400);
  });

  test("deleting a rule removes it but keeps already-generated transactions (history)", async () => {
    const accountId = await makeAccount();
    const pay = await makeEnvelope("Paycheck");
    const rule = (
      await post("/recurring", {
        accountId,
        kind: "deposit",
        amount: "10.00",
        frequency: "weekly",
        anchorOn: isoOffset(-1),
        lines: [{ envelopeId: pay, amount: "10.00" }],
      })
    ).json().recurring;
    await post("/recurring/post-due", {});
    expect((await del(`/recurring/${rule.id}`)).statusCode).toBe(204);
    expect((await get("/recurring")).json().recurring).toHaveLength(0);
    // The generated transaction survives (recurring_id set null on delete).
    expect(await balanceOf("accounts", accountId)).toBe(1000);
    expect((await del(`/recurring/${rule.id}`)).statusCode).toBe(404);
  });
});
