import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { BudgeteerBackup } from "../src/services/backupService";
import { makeRestoreService, parseBackupFile } from "../src/services/restoreService";
import { ConflictError, ValidationError } from "../src/services/errors";
import { type TestApp, closeTestApp, createTestApp } from "./helpers";

/**
 * EH10 / #15b — the restore proof. The load-bearing case is the equivalence gate test:
 * a store populated through the real HTTP API, exported, restored into a fresh store, and
 * re-exported must produce an identical snapshot (SPIKE-09). Everything else is the refusal
 * surface (restore is non-destructive and fails loudly).
 */

let src: TestApp;
const extraApps: TestApp[] = [];
beforeEach(async () => {
  src = await createTestApp();
});
afterEach(async () => {
  await closeTestApp(src);
  for (const a of extraApps.splice(0)) await closeTestApp(a);
});

async function freshTarget(): Promise<TestApp> {
  const target = await createTestApp();
  extraApps.push(target);
  return target;
}

const post = (ctx: TestApp, url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "POST", url, payload: body });
const put = (ctx: TestApp, url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "PUT", url, payload: body });

async function created<T>(res: Promise<{ statusCode: number; json: <U>() => U }>): Promise<T> {
  const r = await res;
  expect([200, 201]).toContain(r.statusCode);
  return r.json<T>();
}

/** Populate every one of the 15 backup tables through the real API (no raw inserts). */
async function populateAllTables(ctx: TestApp) {
  const { account: checking } = await created<{ account: { id: string } }>(
    post(ctx, "/accounts", {
      openedOn: "2026-07-01",
      name: "Checking",
      kind: "checking",
      startingBalance: "500.00",
    }),
  );
  const { account: visa } = await created<{ account: { id: string } }>(
    post(ctx, "/accounts", {
      openedOn: "2026-07-01",
      name: "Visa",
      kind: "credit",
      startingBalance: "0",
    }),
  );
  const { account: loan } = await created<{ account: { id: string } }>(
    post(ctx, "/accounts", {
      openedOn: "2026-07-01",
      name: "Car loan",
      kind: "loan",
      startingBalance: "0",
    }),
  );
  const { envelope: groceries } = await created<{ envelope: { id: string } }>(
    post(ctx, "/envelopes", { name: "Groceries" }),
  );
  const { envelope: vacation } = await created<{ envelope: { id: string } }>(
    post(ctx, "/envelopes", { name: "Vacation" }),
  );

  await created(
    post(ctx, `/accounts/${checking.id}/transactions`, {
      kind: "deposit",
      amount: "100.00",
      occurredOn: "2026-07-01",
      allocations: [{ envelopeId: groceries.id, amount: "100.00" }],
    }),
  );
  await created(
    post(ctx, "/transfers", {
      fromAccountId: checking.id,
      toAccountId: visa.id,
      amount: "25.00",
      occurredOn: "2026-07-02",
      memo: "card payment",
    }),
  );
  await created(
    post(ctx, "/envelope-transfers", {
      fromEnvelopeId: groceries.id,
      toEnvelopeId: vacation.id,
      amount: "10.00",
      occurredOn: "2026-07-02",
    }),
  );
  await created(
    post(ctx, "/templates", {
      name: "Payday",
      lines: [{ envelopeId: groceries.id, amount: "200.00" }],
    }),
  );
  await created(
    post(ctx, "/recurring", {
      accountId: checking.id,
      kind: "withdrawal",
      amount: "50.00",
      payee: "Gym",
      frequency: "monthly",
      anchorOn: "2026-06-05",
      today: "2026-07-03",
      lines: [{ envelopeId: groceries.id, amount: "50.00" }],
    }),
  );
  // Generates transactions carrying recurring_id (the transactions→recurring FK edge).
  await created(post(ctx, "/recurring/post-due", { today: "2026-07-03" }));
  await created(
    post(ctx, `/accounts/${checking.id}/reconciliations`, {
      statementBalance: "525.00",
      reconciledOn: "2026-07-03",
    }),
  );
  await created(put(ctx, `/envelopes/${groceries.id}/target`, { amount: "400.00" }));
  await created(put(ctx, `/accounts/${visa.id}/credit-limit`, { amount: "5000.00" }));
  await created(put(ctx, `/accounts/${loan.id}/original-principal`, { amount: "20000.00" }));
  // An archived account (archived_at set) must survive the round-trip too.
  await created(post(ctx, `/accounts/${visa.id}/archive`, {}));
}

const exportBackup = async (ctx: TestApp): Promise<BudgeteerBackup> =>
  (await ctx.app.inject({ method: "GET", url: "/export" })).json<BudgeteerBackup>();

/** Comparable form: the export timestamp is the only value allowed to differ. */
const comparable = (backup: BudgeteerBackup) => ({ ...backup, exportedAt: null });

describe("restore (EH10 / #15b)", () => {
  test("GATE: export → restore → export is exactly equivalent", async () => {
    await populateAllTables(src);
    const backupA = await exportBackup(src);

    // The fixture must exercise every table, or the proof proves less than it claims.
    for (const [table, rows] of Object.entries(backupA.tables)) {
      expect(rows.length, `fixture left tables.${table} empty`).toBeGreaterThan(0);
    }
    expect(backupA.schema.migrations).toContain("0001-baseline");

    const target = await freshTarget();
    const result = await makeRestoreService(target.db).restore(parseBackupFile(backupA));
    expect(result.warnings).toEqual([]);
    expect(result.tables.households).toBe(1);

    const backupB = await exportBackup(target);
    expect(comparable(backupB)).toEqual(comparable(backupA));
  });

  test("refuses a store that already contains user data, naming the occupied tables", async () => {
    await populateAllTables(src);
    const backup = parseBackupFile(await exportBackup(src));

    const target = await freshTarget();
    await post(target, "/accounts", {
      openedOn: "2026-07-01",
      name: "Existing",
      kind: "checking",
      startingBalance: "1.00",
    });

    const err = await makeRestoreService(target.db)
      .restore(backup)
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as Error).message).toContain("accounts");
    expect((err as Error).message).toContain("db:reset");
    // Non-destructive: the existing data is untouched.
    const after = await exportBackup(target);
    expect(after.tables.accounts).toHaveLength(1);
  });

  test("refuses a backup from a newer schema, naming the missing migration", async () => {
    const backup = parseBackupFile(await exportBackup(src));
    backup.schema!.migrations.push("0099-from-the-future");

    const target = await freshTarget();
    await expect(makeRestoreService(target.db).restore(backup)).rejects.toThrow(
      /newer schema.*0099-from-the-future/s,
    );
  });

  test("a pre-stamping backup (no schema field) restores with a warning", async () => {
    await populateAllTables(src);
    const raw = JSON.parse(JSON.stringify(await exportBackup(src))) as Record<string, unknown>;
    delete raw.schema; // the owner's real pre-EH10 files
    const backup = parseBackupFile(raw);

    const target = await freshTarget();
    const result = await makeRestoreService(target.db).restore(backup);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/without a schema check/);
    expect((await exportBackup(target)).tables.transactions.length).toBeGreaterThan(0);
  });

  test("refuses a backup for a different household", async () => {
    const backup = parseBackupFile(await exportBackup(src));
    backup.householdId = "99999999-9999-9999-9999-999999999999";

    const target = await freshTarget();
    await expect(makeRestoreService(target.db).restore(backup)).rejects.toThrow(ValidationError);
  });

  test("parseBackupFile fails loudly on a malformed file", () => {
    expect(() => parseBackupFile({ hello: "world" })).toThrow(ValidationError);
    expect(() =>
      parseBackupFile({ version: 2, exportedAt: "x", householdId: "y", tables: {} }),
    ).toThrow(/Not a valid Budgeteer backup/);
  });
});
