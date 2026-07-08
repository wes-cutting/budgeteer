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

async function makeAccount(startingBalance = "0"): Promise<string> {
  return (
    await post("/accounts", {
      openedOn: "2026-07-02",
      name: "Checking",
      kind: "checking",
      startingBalance,
    })
  ).json().account.id as string;
}

describe("reconcile-to-bank API (FEAT-010)", () => {
  test("records a reconciliation: snapshots the derived balance and computes the difference", async () => {
    const accountId = await makeAccount("750.00");

    const res = await post(`/accounts/${accountId}/reconciliations`, {
      statementBalance: "800.00", // bank shows $50 more than the book
      reconciledOn: "2026-06-15",
    });
    expect(res.statusCode).toBe(201);
    const rec = res.json().reconciliation;
    expect(rec.derivedBalanceCents).toBe(75000); // snapshot of the opening balance
    expect(rec.statementBalanceCents).toBe(80000);
    expect(rec.differenceCents).toBe(5000); // statement − derived
    expect(rec.matched).toBe(false);
    expect(rec.reconciledOn).toBe("2026-06-15");
  });

  test("matched when the entered balance equals the derived balance", async () => {
    const accountId = await makeAccount("200.00");
    const rec = (
      await post(`/accounts/${accountId}/reconciliations`, {
        statementBalance: "200.00",
        reconciledOn: "2026-07-02",
      })
    ).json().reconciliation;
    expect(rec.matched).toBe(true);
    expect(rec.differenceCents).toBe(0);
  });

  test("accepts a negative statement balance (e.g. a credit account)", async () => {
    const accountId = await makeAccount("0");
    const rec = (
      await post(`/accounts/${accountId}/reconciliations`, {
        statementBalance: "-125.50",
        reconciledOn: "2026-07-02",
      })
    ).json().reconciliation;
    expect(rec.statementBalanceCents).toBe(-12550);
    expect(rec.differenceCents).toBe(-12550); // bank −$125.50 vs book $0
  });

  test("lists reconciliation history newest-first", async () => {
    const accountId = await makeAccount("100.00");
    await post(`/accounts/${accountId}/reconciliations`, {
      statementBalance: "100.00",
      reconciledOn: "2026-05-15",
    });
    await post(`/accounts/${accountId}/reconciliations`, {
      statementBalance: "120.00",
      reconciledOn: "2026-06-15",
    });
    const history = (await get(`/accounts/${accountId}/reconciliations`)).json().reconciliations;
    expect(history).toHaveLength(2);
    expect(history[0].reconciledOn).toBe("2026-06-15");
    expect(history[1].reconciledOn).toBe("2026-05-15");
  });

  test("a missing reconciledOn is rejected — the caller supplies the date (EH8)", async () => {
    const accountId = await makeAccount("0");
    expect(
      (await post(`/accounts/${accountId}/reconciliations`, { statementBalance: "10.00" }))
        .statusCode,
    ).toBe(400);
  });

  test("bad amount → 400; missing account → 404", async () => {
    const accountId = await makeAccount("0");
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    expect(
      (
        await post(`/accounts/${accountId}/reconciliations`, {
          statementBalance: "abc",
          reconciledOn: "2026-07-02",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post(`/accounts/${ghost}/reconciliations`, {
          statementBalance: "10.00",
          reconciledOn: "2026-07-02",
        })
      ).statusCode,
    ).toBe(404);
    expect((await get(`/accounts/${ghost}/reconciliations`)).statusCode).toBe(404);
  });
});
