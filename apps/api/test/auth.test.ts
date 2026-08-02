import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type TestApp, closeTestApp, createAuthTestApp } from "./helpers";
import { createDb } from "../src/db/connection";
import { migrateToLatest } from "../src/db/migrate";
import { buildServer } from "../src/http/server";

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
  return ctx.app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
}
async function login(creds = ADMIN) {
  return ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: creds });
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
      url: "/api/auth/setup",
      payload: { username: "someone", password: "another-password" },
    });
    expect(second.statusCode).toBe(409);
  });

  test("a too-short password is rejected", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "wes", password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("default-deny gate", () => {
  test("an unauthenticated request to a resource route is 401", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/accounts" });
    expect(res.statusCode).toBe(401);
  });

  test("/api/health stays public", async () => {
    expect((await ctx.app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
  });

  test("a valid session unlocks the resource route and scopes it", async () => {
    const cookie = await loginCookie();
    const res = await ctx.app.inject({ method: "GET", url: "/api/accounts", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().accounts).toEqual([]);
    // ...and a write + read round-trips through the authenticated scope.
    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/accounts",
      headers: { cookie },
      payload: {
        name: "Checking",
        kind: "checking",
        startingBalance: "10",
        openedOn: "2026-07-29",
      },
    });
    expect(created.statusCode).toBe(201);
    const after = await ctx.app.inject({
      method: "GET",
      url: "/api/accounts",
      headers: { cookie },
    });
    expect(after.json().accounts).toHaveLength(1);
  });

  test("a tampered/garbage cookie is rejected (401)", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/accounts",
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
    // Not Secure by default: dev and e2e serve plain HTTP, and a Secure cookie there would be
    // discarded by the browser — the login would appear to succeed and then not stick.
    expect(header).not.toMatch(/Secure/i);
  });

  // BUD-S83 — the deployment-shaped half of the same decision (DEPLOY_CONTRACT §5). Asserted here,
  // where the cookie attributes are directly observable, rather than by restarting containers in
  // the deploy harness.
  test("secureCookie adds `Secure`, which is why a TLS-less deployment must turn it off", async () => {
    const db = await createDb();
    await migrateToLatest(db);
    const app = buildServer(db, {
      auth: { sessionSecret: "test-only-session-secret-16+chars", secureCookie: true },
    });
    await app.ready();

    await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
    const raw = (await app.inject({ method: "POST", url: "/api/auth/login", payload: ADMIN }))
      .headers["set-cookie"];
    const header = Array.isArray(raw) ? raw[0] : (raw as string);
    expect(header).toMatch(/Secure/i);

    await app.close();
    await db.destroy();
  });
});

describe("session lifecycle", () => {
  test("/api/auth/me returns the user when authed, 401 when not", async () => {
    const cookie = await loginCookie();
    const me = await ctx.app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.role).toBe("admin");
    expect((await ctx.app.inject({ method: "GET", url: "/api/auth/me" })).statusCode).toBe(401);
  });

  test("logout invalidates the session server-side", async () => {
    const cookie = await loginCookie();
    expect(
      (await ctx.app.inject({ method: "GET", url: "/api/accounts", headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    await ctx.app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    // The same cookie no longer resolves — the session row is gone (not just the browser cookie).
    expect(
      (await ctx.app.inject({ method: "GET", url: "/api/accounts", headers: { cookie } }))
        .statusCode,
    ).toBe(401);
  });
});

describe("user management (BUD-S88)", () => {
  const MEMBER = { username: "member1", password: "member-password" };

  async function createMember(adminCookie: string) {
    return ctx.app.inject({
      method: "POST",
      url: "/api/users",
      headers: { cookie: adminCookie },
      payload: { ...MEMBER, role: "member" },
    });
  }
  const memberCookie = async () => cookieFrom(await login(MEMBER));
  const get = (url: string, cookie: string) =>
    ctx.app.inject({ method: "GET", url, headers: { cookie } });
  const post = (url: string, cookie: string) =>
    ctx.app.inject({ method: "POST", url, headers: { cookie } });

  test("an admin adds a member who can log in but is not an admin", async () => {
    const admin = await loginCookie();
    expect((await createMember(admin)).statusCode).toBe(201);
    const me = await get("/api/auth/me", await memberCookie());
    expect(me.json().user.role).toBe("member");
  });

  test("a member is forbidden from user management (403)", async () => {
    const admin = await loginCookie();
    await createMember(admin);
    const member = await memberCookie();
    expect((await get("/api/users", member)).statusCode).toBe(403);
    expect(
      (
        await ctx.app.inject({
          method: "POST",
          url: "/api/users",
          headers: { cookie: member },
          payload: { username: "x", password: "yyyyyyyy", role: "member" },
        })
      ).statusCode,
    ).toBe(403);
  });

  test("disabling a user revokes their sessions and blocks re-login until re-enabled", async () => {
    const admin = await loginCookie();
    const memberId = (await createMember(admin)).json().user.id;
    const member = await memberCookie();
    expect((await get("/api/accounts", member)).statusCode).toBe(200);

    expect((await post(`/api/users/${memberId}/disable`, admin)).statusCode).toBe(200);
    expect((await get("/api/accounts", member)).statusCode).toBe(401); // existing session revoked
    expect((await login(MEMBER)).statusCode).toBe(401); // and can't sign back in

    expect((await post(`/api/users/${memberId}/enable`, admin)).statusCode).toBe(200);
    expect((await login(MEMBER)).statusCode).toBe(200); // re-enabled
  });

  test("reset-password revokes existing sessions and swaps the password", async () => {
    const admin = await loginCookie();
    const memberId = (await createMember(admin)).json().user.id;
    const member = await memberCookie();
    expect((await get("/api/accounts", member)).statusCode).toBe(200);

    const reset = await ctx.app.inject({
      method: "POST",
      url: `/api/users/${memberId}/reset-password`,
      headers: { cookie: admin },
      payload: { password: "new-member-pass" },
    });
    expect(reset.statusCode).toBe(200);
    expect((await get("/api/accounts", member)).statusCode).toBe(401); // old session revoked
    expect((await login(MEMBER)).statusCode).toBe(401); // old password rejected
    expect(
      (await login({ username: MEMBER.username, password: "new-member-pass" })).statusCode,
    ).toBe(200);
  });

  test("an admin can't disable their own account (400)", async () => {
    const admin = await loginCookie();
    const adminId = (await get("/api/auth/me", admin)).json().user.userId;
    expect((await post(`/api/users/${adminId}/disable`, admin)).statusCode).toBe(400);
  });
});
