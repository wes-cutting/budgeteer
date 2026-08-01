import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type TestApp, closeTestApp, createAuthTestApp } from "./helpers";

// BUD-S87 — the auth gate + login/session lifecycle (ADR-0009), exercised against an
// auth-ENABLED app. The other suites run open (createTestApp) and test business logic.

let ctx: TestApp;
beforeEach(async () => {
  ctx = await createAuthTestApp();
});
afterEach(async () => {
  await closeTestApp(ctx);
});

const ADMIN = { username: "wes", password: "correct horse battery" };

/** Extract the bare `name=value` from a Set-Cookie header for use as a request Cookie. */
function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : (raw as string);
  return header.split(";")[0];
}

async function setup() {
  return ctx.app.inject({ method: "POST", url: "/auth/setup", payload: ADMIN });
}
async function login(creds = ADMIN) {
  return ctx.app.inject({ method: "POST", url: "/auth/login", payload: creds });
}
async function loginCookie(): Promise<string> {
  await setup();
  return cookieFrom(await login());
}

describe("first-run setup", () => {
  test("creates the first admin, then is a dead endpoint", async () => {
    expect((await setup()).statusCode).toBe(201);
    const second = await ctx.app.inject({
      method: "POST",
      url: "/auth/setup",
      payload: { username: "someone", password: "another-password" },
    });
    expect(second.statusCode).toBe(409);
  });

  test("a too-short password is rejected", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/auth/setup",
      payload: { username: "wes", password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("default-deny gate", () => {
  test("an unauthenticated request to a resource route is 401", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/accounts" });
    expect(res.statusCode).toBe(401);
  });

  test("/health stays public", async () => {
    expect((await ctx.app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });

  test("a valid session unlocks the resource route and scopes it", async () => {
    const cookie = await loginCookie();
    const res = await ctx.app.inject({ method: "GET", url: "/accounts", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().accounts).toEqual([]);
    // ...and a write + read round-trips through the authenticated scope.
    const created = await ctx.app.inject({
      method: "POST",
      url: "/accounts",
      headers: { cookie },
      payload: {
        name: "Checking",
        kind: "checking",
        startingBalance: "10",
        openedOn: "2026-07-29",
      },
    });
    expect(created.statusCode).toBe(201);
    const after = await ctx.app.inject({ method: "GET", url: "/accounts", headers: { cookie } });
    expect(after.json().accounts).toHaveLength(1);
  });

  test("a tampered/garbage cookie is rejected (401)", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/accounts",
      headers: { cookie: "budgeteer_session=not-a-valid-signed-token" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("login", () => {
  test("wrong password and unknown user return the identical 401 (enumeration-safe)", async () => {
    await setup();
    const wrong = await login({ username: ADMIN.username, password: "nope" });
    const unknown = await login({ username: "ghost", password: "whatever" });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(unknown.body).toBe(wrong.body);
  });

  test("the session cookie is HttpOnly + SameSite", async () => {
    await setup();
    const raw = (await login()).headers["set-cookie"];
    const header = Array.isArray(raw) ? raw[0] : (raw as string);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Strict/i);
  });
});

describe("session lifecycle", () => {
  test("/auth/me returns the user when authed, 401 when not", async () => {
    const cookie = await loginCookie();
    const me = await ctx.app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.role).toBe("admin");
    expect((await ctx.app.inject({ method: "GET", url: "/auth/me" })).statusCode).toBe(401);
  });

  test("logout invalidates the session server-side", async () => {
    const cookie = await loginCookie();
    expect(
      (await ctx.app.inject({ method: "GET", url: "/accounts", headers: { cookie } })).statusCode,
    ).toBe(200);
    await ctx.app.inject({ method: "POST", url: "/auth/logout", headers: { cookie } });
    // The same cookie no longer resolves — the session row is gone (not just the browser cookie).
    expect(
      (await ctx.app.inject({ method: "GET", url: "/accounts", headers: { cookie } })).statusCode,
    ).toBe(401);
  });
});
