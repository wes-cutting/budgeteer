import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDb } from "../src/db/connection";
import { migrateToLatest } from "../src/db/migrate";
import { buildServer } from "../src/http/server";
import { makeAuthService } from "../src/services/authService";
import { DEFAULT_HOUSEHOLD_ID } from "../src/constants";
import { ValidationError } from "../src/services/errors";
import { type TestApp, closeTestApp, createAuthTestApp } from "./helpers";

// BUD-S89 — the login-hardening + threat-model invariants (ADR-0009 §9): brute-force throttle,
// session expiry, last-admin protection, and household scoping.

const ADMIN = { username: "wes", password: "correct horse battery" };
const AUTH = { sessionSecret: "test-only-session-secret-16+chars" };

function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : (raw as string);
  return header.split(";")[0];
}

describe("login throttle + household scoping", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await createAuthTestApp();
  });
  afterEach(async () => {
    await closeTestApp(ctx);
  });

  const login = (creds: { username: string; password: string }) =>
    ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: creds });
  const setup = () => ctx.app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });

  test("locks out (429) after repeated failures; a different username is unaffected", async () => {
    await setup();
    for (let i = 0; i < 5; i++) {
      expect((await login({ username: ADMIN.username, password: "wrong" })).statusCode).toBe(401);
    }
    // Now locked — even the correct password is refused for this (ip, username) pair.
    expect((await login(ADMIN)).statusCode).toBe(429);
    // A different account is not collateral-damaged (keyed on the pair, not the username alone).
    expect((await login({ username: "someone-else", password: "wrong" })).statusCode).toBe(401);
  });

  test("user management is household-scoped — another household's user is not-found, not forbidden", async () => {
    const admin = cookieFrom(await (await setup(), login(ADMIN)));
    // A second household + an admin in it, created directly (no cross-household API exists).
    const HH_B = "11111111-1111-1111-1111-111111111111";
    await ctx.db.insertInto("households").values({ id: HH_B, name: "Other" }).execute();
    const other = await makeAuthService(ctx.db, () => new Date()).createUser({
      username: "b-admin",
      password: "password123",
      role: "admin",
      householdId: HH_B,
    });
    // Household A's admin never sees household B's users...
    const list = await ctx.app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: admin },
    });
    expect(list.json().users.map((u: { username: string }) => u.username)).not.toContain("b-admin");
    // ...and can't touch them — scoped away as 404 (existence doesn't leak), never 200/403.
    const disable = await ctx.app.inject({
      method: "POST",
      url: `/api/users/${other.id}/disable`,
      headers: { cookie: admin },
    });
    expect(disable.statusCode).toBe(404);
  });
});

describe("session expiry + last-admin protection", () => {
  test("an expired session is rejected and its row cleaned up", async () => {
    const db = await createDb();
    await migrateToLatest(db);
    let now = new Date("2026-07-31T12:00:00Z").getTime();
    const app = buildServer(db, { auth: AUTH, clock: () => new Date(now) });
    await app.ready();

    await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
    const cookie = cookieFrom(
      await app.inject({ method: "POST", url: "/api/auth/login", payload: ADMIN }),
    );
    expect(
      (await app.inject({ method: "GET", url: "/api/accounts", headers: { cookie } })).statusCode,
    ).toBe(200);

    now += 31 * 24 * 60 * 60 * 1000; // past the 30-day TTL
    expect(
      (await app.inject({ method: "GET", url: "/api/accounts", headers: { cookie } })).statusCode,
    ).toBe(401);
    expect(await db.selectFrom("sessions").selectAll().execute()).toHaveLength(0); // cleaned up

    await app.close();
    await db.destroy();
  });

  test("the last active admin can't be disabled; with two admins either may be", async () => {
    const db = await createDb();
    await migrateToLatest(db);
    const auth = makeAuthService(db, () => new Date());
    const solo = await auth.createUser({
      username: "solo",
      password: "password123",
      role: "admin",
      householdId: DEFAULT_HOUSEHOLD_ID,
    });
    await expect(auth.setDisabled(solo.id, true, DEFAULT_HOUSEHOLD_ID)).rejects.toThrow(
      ValidationError,
    );

    const second = await auth.createUser({
      username: "second",
      password: "password123",
      role: "admin",
      householdId: DEFAULT_HOUSEHOLD_ID,
    });
    // Two active admins → disabling one is allowed (one remains).
    await auth.setDisabled(second.id, true, DEFAULT_HOUSEHOLD_ID);
    // ...but now `solo` is again the last active admin and is protected.
    await expect(auth.setDisabled(solo.id, true, DEFAULT_HOUSEHOLD_ID)).rejects.toThrow(
      ValidationError,
    );

    await db.destroy();
  });
});
