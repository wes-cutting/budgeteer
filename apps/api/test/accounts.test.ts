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
const patch = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "PATCH", url, payload: body });
const get = (url: string) => ctx.app.inject({ method: "GET", url });

describe("accounts API (FEAT-001)", () => {
  test("create with a starting balance → 201 with that balance (opening txn)", async () => {
    const res = await post("/accounts", {
      openedOn: "2026-07-02",
      name: "Checking",
      kind: "checking",
      startingBalance: "2140.00",
    });
    expect(res.statusCode).toBe(201);
    const { account } = res.json();
    expect(account.name).toBe("Checking");
    expect(account.kind).toBe("checking");
    expect(account.balanceCents).toBe(214000);
  });

  test("zero and negative starting balances are allowed", async () => {
    expect(
      (
        await post("/accounts", {
          openedOn: "2026-07-02",
          name: "Wallet",
          kind: "cash",
          startingBalance: "0",
        })
      ).json().account.balanceCents,
    ).toBe(0);
    expect(
      (
        await post("/accounts", {
          openedOn: "2026-07-02",
          name: "CapOne",
          kind: "credit",
          startingBalance: "-412.00",
        })
      ).json().account.balanceCents,
    ).toBe(-41200);
  });

  test("invalid amount → 400 and nothing is created", async () => {
    const res = await post("/accounts", {
      openedOn: "2026-07-02",
      name: "Bad",
      kind: "checking",
      startingBalance: "12.345",
    });
    expect(res.statusCode).toBe(400);
    expect((await get("/accounts")).json().accounts).toHaveLength(0);
  });

  test("empty name → 400; unknown kind → 400", async () => {
    expect(
      (
        await post("/accounts", {
          openedOn: "2026-07-02",
          name: "   ",
          kind: "checking",
          startingBalance: "0",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post("/accounts", {
          openedOn: "2026-07-02",
          name: "X",
          kind: "crypto",
          startingBalance: "0",
        })
      ).statusCode,
    ).toBe(400);
  });

  test("duplicate name (case-insensitive) → 409", async () => {
    await post("/accounts", {
      openedOn: "2026-07-02",
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    const res = await post("/accounts", {
      openedOn: "2026-07-02",
      name: "checking",
      kind: "savings",
      startingBalance: "0",
    });
    expect(res.statusCode).toBe(409);
  });

  test("list returns created accounts with derived balances", async () => {
    await post("/accounts", {
      openedOn: "2026-07-02",
      name: "A",
      kind: "checking",
      startingBalance: "100.00",
    });
    await post("/accounts", {
      openedOn: "2026-07-02",
      name: "B",
      kind: "savings",
      startingBalance: "50.00",
    });
    const accounts = (await get("/accounts")).json().accounts;
    expect(accounts).toHaveLength(2);
    expect(
      accounts
        .map((a: { balanceCents: number }) => a.balanceCents)
        .sort((x: number, y: number) => x - y),
    ).toEqual([5000, 10000]);
  });

  test("archive sets archivedAt; unarchive clears it; missing id → 404", async () => {
    const a = (
      await post("/accounts", {
        openedOn: "2026-07-02",
        name: "A",
        kind: "checking",
        startingBalance: "0",
      })
    ).json().account;

    const archived = await post(`/accounts/${a.id}/archive`);
    expect(archived.statusCode).toBe(200);
    expect(archived.json().account.archivedAt).not.toBeNull();

    const unarchived = await post(`/accounts/${a.id}/unarchive`);
    expect(unarchived.statusCode).toBe(200);
    expect(unarchived.json().account.archivedAt).toBeNull();

    expect((await post("/accounts/00000000-0000-0000-0000-0000000000ff/archive")).statusCode).toBe(
      404,
    );
  });

  test("rename updates the name; duplicate rename → 409; missing → 404", async () => {
    const a = (
      await post("/accounts", {
        openedOn: "2026-07-02",
        name: "A",
        kind: "checking",
        startingBalance: "0",
      })
    ).json().account;
    await post("/accounts", {
      openedOn: "2026-07-02",
      name: "B",
      kind: "savings",
      startingBalance: "0",
    });

    const ok = await patch(`/accounts/${a.id}`, { name: "A renamed" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().account.name).toBe("A renamed");

    expect((await patch(`/accounts/${a.id}`, { name: "B" })).statusCode).toBe(409);
    expect(
      (await patch(`/accounts/00000000-0000-0000-0000-0000000000ff`, { name: "Z" })).statusCode,
    ).toBe(404);
  });
});
