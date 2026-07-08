import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type TestApp, closeTestApp, createTestApp } from "./helpers";

// Since EH8 the caller supplies `today` (client-local) on every due-ness read/write, so the
// suite is deterministic by construction; the clock pin (EH7) is kept only for the absolute
// fixture-date discipline it documents.
const TODAY = "2026-03-28";

let ctx: TestApp;
beforeEach(async () => {
  ctx = await createTestApp({ today: TODAY });
});
afterEach(async () => {
  await closeTestApp(ctx);
});

const post = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "POST", url, payload: body });
const del = (url: string) => ctx.app.inject({ method: "DELETE", url });
const get = (url: string) => ctx.app.inject({ method: "GET", url });

async function makeEnvelope(name: string): Promise<string> {
  return (await post("/envelopes", { name })).json().envelope.id as string;
}
async function makeAccount(): Promise<string> {
  return (
    await post("/accounts", {
      openedOn: "2026-07-02",
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    })
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
      today: TODAY,
      anchorOn: "2026-04-04", // a week past TODAY → nothing due yet
      lines: [{ envelopeId: rent, amount: "1500.00" }],
    });
    expect(res.statusCode).toBe(201);
    const rule = res.json().recurring;
    expect(rule.nextOccurrenceOn).toBe("2026-04-04");
    expect(rule.dueCount).toBe(0);
    expect(rule.lines).toHaveLength(1);
  });

  test("post-due generates every due occurrence, sets the split, and is idempotent", async () => {
    const accountId = await makeAccount();
    const pay = await makeEnvelope("Paycheck");
    // Weekly, anchored 21 days before TODAY → occurrences Mar 7, 14, 21, 28 = 4, all inside
    // the register's default current-month window.
    await post("/recurring", {
      accountId,
      kind: "deposit",
      amount: "10.00",
      frequency: "weekly",
      anchorOn: "2026-03-07",
      today: TODAY,
      lines: [{ envelopeId: pay, amount: "10.00" }],
    });

    const first = await post("/recurring/post-due", { today: TODAY });
    expect(first.statusCode).toBe(200);
    expect(first.json().result.posted).toBe(4);
    expect(await balanceOf("accounts", accountId)).toBe(4000); // 4 × $10
    expect(await balanceOf("envelopes", pay)).toBe(4000); // fully allocated each time

    // Generated transactions are real register rows, linked to the rule.
    const register = (
      await get(`/accounts/${accountId}/transactions?from=2026-03-01&to=2026-03-31`)
    ).json().transactions;
    expect(
      register.filter((t: { recurringId: string | null }) => t.recurringId !== null),
    ).toHaveLength(4);

    // Re-running posts nothing (cursor parked in the future).
    const second = await post("/recurring/post-due", { today: TODAY });
    expect(second.json().result.posted).toBe(0);
    expect(await balanceOf("accounts", accountId)).toBe(4000);

    // The rule's due count is now 0.
    const rule = (await get(`/recurring?today=${TODAY}`)).json().recurring[0];
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
      anchorOn: "2026-03-27", // one occurrence due (the day before TODAY)
      today: TODAY,
      lines: [{ envelopeId: pay, amount: "60.00" }], // $40 unallocated
    });
    await post("/recurring/post-due", { today: TODAY });
    const needs = (await get("/transactions/needs-allocation")).json().transactions;
    expect(needs.some((t: { unallocatedCents: number }) => t.unallocatedCents === 4000)).toBe(true);
  });

  test("validation: bad frequency / missing account / no lines / over-allocated split are rejected", async () => {
    const accountId = await makeAccount();
    const rent = await makeEnvelope("Rent");
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    const base = { kind: "withdrawal", amount: "100.00", anchorOn: TODAY, today: TODAY };

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

  test("a missing today is rejected loudly on list, create, and post-due (EH8)", async () => {
    const accountId = await makeAccount();
    const rent = await makeEnvelope("Rent");
    expect((await get("/recurring")).statusCode).toBe(400);
    expect((await post("/recurring/post-due", {})).statusCode).toBe(400);
    expect(
      (
        await post("/recurring", {
          accountId,
          kind: "withdrawal",
          amount: "100.00",
          frequency: "monthly",
          anchorOn: TODAY,
          lines: [{ envelopeId: rent, amount: "100.00" }],
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
        anchorOn: "2026-03-27",
        today: TODAY,
        lines: [{ envelopeId: pay, amount: "10.00" }],
      })
    ).json().recurring;
    await post("/recurring/post-due", { today: TODAY });
    expect((await del(`/recurring/${rule.id}`)).statusCode).toBe(204);
    expect((await get(`/recurring?today=${TODAY}`)).json().recurring).toHaveLength(0);
    // The generated transaction survives (recurring_id set null on delete).
    expect(await balanceOf("accounts", accountId)).toBe(1000);
    expect((await del(`/recurring/${rule.id}`)).statusCode).toBe(404);
  });
});
