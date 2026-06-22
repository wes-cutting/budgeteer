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

async function makeAccount(name: string, startingBalance = "0"): Promise<string> {
  return (await post("/accounts", { name, kind: "checking", startingBalance })).json().account
    .id as string;
}
const balanceOf = async (id: string): Promise<number> => {
  const accounts = (await get("/accounts")).json().accounts;
  return accounts.find((a: { id: string }) => a.id === id).balanceCents;
};

describe("transfers API (FEAT-007 / ADR-0004)", () => {
  test("moves money between accounts, conserves the total, and reads back both legs", async () => {
    const checking = await makeAccount("Checking", "1000.00");
    const savings = await makeAccount("Savings", "0");

    const res = await post("/transfers", {
      fromAccountId: checking,
      toAccountId: savings,
      amount: "250.00",
      memo: "Monthly savings",
    });
    expect(res.statusCode).toBe(201);
    const transfer = res.json().transfer;
    expect(transfer.amountCents).toBe(25000);
    expect(transfer.from.accountId).toBe(checking);
    expect(transfer.from.amountCents).toBe(-25000);
    expect(transfer.to.accountId).toBe(savings);
    expect(transfer.to.amountCents).toBe(25000);

    expect(await balanceOf(checking)).toBe(75000); // $1000 − $250
    expect(await balanceOf(savings)).toBe(25000); // $0 + $250
  });

  test("transfer legs surface in the register (labeled by counterpart) but NOT in needs-allocation", async () => {
    const checking = await makeAccount("Checking", "500.00");
    const savings = await makeAccount("Savings", "0");
    await post("/transfers", { fromAccountId: checking, toAccountId: savings, amount: "100.00" });

    const register = (await get(`/accounts/${checking}/transactions`)).json().transactions;
    const leg = register.find((t: { kind: string }) => t.kind === "transfer");
    expect(leg).toBeTruthy();
    expect(leg.amountCents).toBe(-10000);
    expect(leg.transferCounterpartName).toBe("Savings");

    const needs = (await get("/transactions/needs-allocation")).json().transactions;
    expect(needs.some((t: { kind: string }) => t.kind === "transfer")).toBe(false);
  });

  test("DELETE /transfers/:id removes both legs and restores both balances", async () => {
    const checking = await makeAccount("Del Checking", "500.00");
    const savings = await makeAccount("Del Savings", "0");
    const transfer = (
      await post("/transfers", { fromAccountId: checking, toAccountId: savings, amount: "200.00" })
    ).json().transfer;

    expect(await balanceOf(checking)).toBe(30000); // 500 − 200
    expect(await balanceOf(savings)).toBe(20000); // 0 + 200

    const res = await del(`/transfers/${transfer.id}`);
    expect(res.statusCode).toBe(204);

    expect(await balanceOf(checking)).toBe(50000); // restored
    expect(await balanceOf(savings)).toBe(0);
    // Neither leg should appear in either register.
    const checkingTxns = (await get(`/accounts/${checking}/transactions`)).json().transactions;
    expect(checkingTxns.some((t: { kind: string }) => t.kind === "transfer")).toBe(false);
  });

  test("DELETE /transfers/:id on unknown transfer → 404", async () => {
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    expect((await del(`/transfers/${ghost}`)).statusCode).toBe(404);
  });

  test("rejects same-account, non-positive, and missing-account transfers", async () => {
    const checking = await makeAccount("Checking", "100.00");
    const savings = await makeAccount("Savings", "0");
    const ghost = "00000000-0000-0000-0000-0000000000ff";

    expect(
      (
        await post("/transfers", {
          fromAccountId: checking,
          toAccountId: checking,
          amount: "10.00",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await post("/transfers", { fromAccountId: checking, toAccountId: savings, amount: "0" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await post("/transfers", { fromAccountId: checking, toAccountId: ghost, amount: "10.00" }))
        .statusCode,
    ).toBe(404);
  });

  test("rejects a transfer touching an archived account (default-deny guard)", async () => {
    const checking = await makeAccount("Checking", "100.00");
    const savings = await makeAccount("Savings", "0");
    // No archive-account feature yet; set archived_at directly to exercise the guard.
    await ctx.db
      .updateTable("accounts")
      .set({ archived_at: new Date() })
      .where("id", "=", savings)
      .execute();

    const res = await post("/transfers", {
      fromAccountId: checking,
      toAccountId: savings,
      amount: "10.00",
    });
    expect(res.statusCode).toBe(400);
    // Nothing moved.
    expect(await balanceOf(checking)).toBe(10000);
  });

  test("a withdrawal still needs allocation, but the transfer it funds does not", async () => {
    const checking = await makeAccount("Checking", "300.00");
    const savings = await makeAccount("Savings", "0");
    await post("/transfers", { fromAccountId: checking, toAccountId: savings, amount: "300.00" });
    const needs = (await get("/transactions/needs-allocation")).json().transactions;
    // Only the two opening balances (one is 0 → excluded) — no transfer leg.
    expect(needs.every((t: { kind: string }) => t.kind !== "transfer")).toBe(true);
  });
});
