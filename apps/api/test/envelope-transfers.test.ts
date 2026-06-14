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

async function makeEnvelope(name: string): Promise<string> {
  return (await post("/envelopes", { name })).json().envelope.id as string;
}
const balanceOf = async (collection: "accounts" | "envelopes", id: string): Promise<number> => {
  const items = (await get(`/${collection}`)).json()[collection];
  return items.find((x: { id: string }) => x.id === id).balanceCents;
};

/** Seed: a funded account split across two envelopes, so they have real balances to move. */
async function seed() {
  const accountId = (
    await post("/accounts", { name: "Checking", kind: "checking", startingBalance: "0" })
  ).json().account.id as string;
  const groceries = await makeEnvelope("Groceries");
  const vacation = await makeEnvelope("Vacation");
  await post(`/accounts/${accountId}/transactions`, {
    kind: "deposit",
    amount: "1000.00",
    allocations: [
      { envelopeId: groceries, amount: "600.00" },
      { envelopeId: vacation, amount: "400.00" },
    ],
  });
  return { accountId, groceries, vacation };
}

describe("envelope reallocation API (FEAT-007 #7b / ADR-0004 B)", () => {
  test("moves budgeted money between envelopes, conserves the total, leaves accounts untouched", async () => {
    const { accountId, groceries, vacation } = await seed();

    const res = await post("/envelope-transfers", {
      fromEnvelopeId: groceries,
      toEnvelopeId: vacation,
      amount: "150.00",
      memo: "Trip fund",
    });
    expect(res.statusCode).toBe(201);
    const et = res.json().envelopeTransfer;
    expect(et.amountCents).toBe(15000);
    expect(et.from.envelopeName).toBe("Groceries");
    expect(et.to.envelopeName).toBe("Vacation");

    expect(await balanceOf("envelopes", groceries)).toBe(45000); // $600 − $150
    expect(await balanceOf("envelopes", vacation)).toBe(55000); // $400 + $150
    expect(await balanceOf("accounts", accountId)).toBe(100000); // account untouched
  });

  test("rejects same-envelope, non-positive, and missing-envelope reallocations", async () => {
    const { groceries, vacation } = await seed();
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    expect(
      (
        await post("/envelope-transfers", {
          fromEnvelopeId: groceries,
          toEnvelopeId: groceries,
          amount: "10.00",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post("/envelope-transfers", {
          fromEnvelopeId: groceries,
          toEnvelopeId: vacation,
          amount: "0",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post("/envelope-transfers", {
          fromEnvelopeId: groceries,
          toEnvelopeId: ghost,
          amount: "10.00",
        })
      ).statusCode,
    ).toBe(404);
  });

  test("can't move INTO an archived envelope, but draining FROM one is allowed", async () => {
    const { groceries, vacation } = await seed();
    await post(`/envelopes/${vacation}/archive`, {});

    // INTO archived → 400
    expect(
      (
        await post("/envelope-transfers", {
          fromEnvelopeId: groceries,
          toEnvelopeId: vacation,
          amount: "10.00",
        })
      ).statusCode,
    ).toBe(400);

    // FROM archived → allowed (drain remaining balance out before/after archiving)
    const drain = await post("/envelope-transfers", {
      fromEnvelopeId: vacation,
      toEnvelopeId: groceries,
      amount: "400.00",
    });
    expect(drain.statusCode).toBe(201);
    expect(await balanceOf("envelopes", vacation)).toBe(0); // $400 − $400
    expect(await balanceOf("envelopes", groceries)).toBe(100000); // $600 + $400
  });

  test("overdrawing an envelope is allowed → it goes negative (consistent with over-spending)", async () => {
    const { groceries, vacation } = await seed();
    const res = await post("/envelope-transfers", {
      fromEnvelopeId: vacation,
      toEnvelopeId: groceries,
      amount: "500.00", // vacation only has $400
    });
    expect(res.statusCode).toBe(201);
    expect(await balanceOf("envelopes", vacation)).toBe(-10000); // $400 − $500
    expect(await balanceOf("envelopes", groceries)).toBe(110000); // $600 + $500
  });
});
