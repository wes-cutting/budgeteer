import { afterEach, beforeEach, expect, test } from "vitest";
import { sql } from "kysely";
import { type TestApp, closeTestApp, createAuthTestApp } from "./helpers";
import { truncateLedger } from "../src/db/resetLedger";
import { makeRestoreService, parseBackupFile } from "../src/services/restoreService";
import { DEFAULT_HOUSEHOLD_ID } from "../src/constants";

/**
 * BUD-S90 — "a rebuilt store has a way in."
 *
 * The documented disaster-recovery flow is export → `db:reset` → `db:restore` (DEPLOY_CONTRACT §7).
 * Because auth state and ledger state sit in separate tables, that flow used to hand back a
 * complete ledger with **no account able to sign in**: reset truncated `households` CASCADE and
 * `users.household_id` references it, while `/api/export` carries no users.
 *
 * This suite runs the whole round-trip through the real HTTP surface with auth ON, and asserts the
 * thing the harness can only assert against a deployed container: the operator who took the backup
 * can still log in to the store they restored it into.
 */

let ctx: TestApp;
beforeEach(async () => {
  ctx = await createAuthTestApp();
});
afterEach(async () => {
  await closeTestApp(ctx);
});

const ADMIN = { username: "wes", password: "correct horse battery" };

function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : (raw as string);
  return header.split(";")[0];
}

test("export → reset → restore keeps the ledger AND the accounts that can reach it", async () => {
  expect(
    (await ctx.app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN })).statusCode,
  ).toBe(201);
  const cookie = cookieFrom(
    await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: ADMIN }),
  );

  const created = await ctx.app.inject({
    method: "POST",
    url: "/api/envelopes",
    headers: { cookie },
    payload: { name: "Groceries" },
  });
  expect(created.statusCode).toBe(201);

  const exported = await ctx.app.inject({ method: "GET", url: "/api/export", headers: { cookie } });
  expect(exported.statusCode).toBe(200);
  const backup = parseBackupFile(exported.json());
  // The backup is a LEDGER backup — it carries no accounts, which is exactly why reset must not
  // destroy them. If this ever changes, the reasoning below needs revisiting, not just the number.
  expect(Object.keys(backup.tables)).not.toContain("users");

  await truncateLedger(ctx.db);

  const afterReset = await ctx.db.selectFrom("envelopes").select("id").execute();
  expect(afterReset).toHaveLength(0);
  // The household row survives — it is what `users.household_id` hangs off, and restore upserts
  // over it rather than requiring it to be absent.
  const household = await ctx.db
    .selectFrom("households")
    .select("id")
    .where("id", "=", DEFAULT_HOUSEHOLD_ID)
    .executeTakeFirst();
  expect(household?.id).toBe(DEFAULT_HOUSEHOLD_ID);

  // The regression this suite exists for: reset used to leave zero users.
  const users = await ctx.db.selectFrom("users").select("id").execute();
  expect(users).toHaveLength(1);

  await makeRestoreService(ctx.db).restore(backup);

  const restored = await ctx.app.inject({
    method: "GET",
    url: "/api/envelopes",
    headers: { cookie },
  });
  expect(restored.statusCode).toBe(200);
  expect(restored.json<{ envelopes: { name: string }[] }>().envelopes.map((e) => e.name)).toContain(
    "Groceries",
  );

  // The end state that matters to a household recovering a box: a fresh login works, with no
  // out-of-band `create-admin` run in between.
  const relogin = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: ADMIN });
  expect(relogin.statusCode).toBe(200);
});

test("surviving accounts do not block a restore into the reset store", async () => {
  await ctx.app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
  const cookie = cookieFrom(
    await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: ADMIN }),
  );
  await ctx.app.inject({
    method: "POST",
    url: "/api/envelopes",
    headers: { cookie },
    payload: { name: "Groceries" },
  });
  const backup = parseBackupFile(
    (await ctx.app.inject({ method: "GET", url: "/api/export", headers: { cookie } })).json(),
  );

  await truncateLedger(ctx.db);

  // `users` is not one of restore's 15 backup tables and the emptiness check excludes the default
  // household, so neither the surviving accounts nor the surviving household count as "occupied".
  await expect(makeRestoreService(ctx.db).restore(backup)).resolves.toMatchObject({
    tables: { households: 1, envelopes: 1 },
  });
});

test("truncateLedger empties every ledger table it names", async () => {
  await ctx.app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
  const cookie = cookieFrom(
    await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: ADMIN }),
  );
  const account = await ctx.app.inject({
    method: "POST",
    url: "/api/accounts",
    headers: { cookie },
    payload: {
      openedOn: "2026-07-01",
      name: "Checking",
      kind: "checking",
      startingBalance: "500.00",
    },
  });
  expect(account.statusCode).toBe(201);

  await truncateLedger(ctx.db);

  // A transaction row is the load-bearing one: `startingBalance` writes an opening transaction, so
  // this proves the truncate reaches the child tables and not only the parents it lists first.
  const rows = await sql<{
    accounts: number;
    transactions: number;
  }>`select (select count(*) from accounts)::int as accounts, (select count(*) from transactions)::int as transactions`.execute(
    ctx.db,
  );
  expect(rows.rows[0]).toEqual({ accounts: 0, transactions: 0 });
});
