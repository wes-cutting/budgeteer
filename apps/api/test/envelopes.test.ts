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

describe("envelopes API (FEAT-002)", () => {
  test("create → 201 with a $0.00 balance and default kind 'standard'", async () => {
    const res = await post("/envelopes", { name: "Groceries" });
    expect(res.statusCode).toBe(201);
    const { envelope } = res.json();
    expect(envelope.name).toBe("Groceries");
    expect(envelope.kind).toBe("standard");
    expect(envelope.balanceCents).toBe(0);
  });

  test("a sinking fund can be created", async () => {
    const res = await post("/envelopes", { name: "Vacation", kind: "sinking_fund" });
    expect(res.statusCode).toBe(201);
    expect(res.json().envelope.kind).toBe("sinking_fund");
  });

  test("empty name → 400; unknown kind → 400", async () => {
    expect((await post("/envelopes", { name: " " })).statusCode).toBe(400);
    expect((await post("/envelopes", { name: "X", kind: "bogus" })).statusCode).toBe(400);
  });

  test("duplicate name (case-insensitive) → 409", async () => {
    await post("/envelopes", { name: "Groceries" });
    expect((await post("/envelopes", { name: "groceries" })).statusCode).toBe(409);
  });

  test("list returns created envelopes at $0.00", async () => {
    await post("/envelopes", { name: "Rent" });
    await post("/envelopes", { name: "Gas" });
    const envelopes = (await get("/envelopes")).json().envelopes;
    expect(envelopes).toHaveLength(2);
    expect(envelopes.every((e: { balanceCents: number }) => e.balanceCents === 0)).toBe(true);
  });
});
