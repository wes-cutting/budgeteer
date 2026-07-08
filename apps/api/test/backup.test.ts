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

type BackupTables = {
  households: Record<string, unknown>[];
  accounts: Record<string, unknown>[];
  envelopes: Record<string, unknown>[];
  transfers: Record<string, unknown>[];
  envelope_transfers: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  allocations: Record<string, unknown>[];
  templates: Record<string, unknown>[];
  template_lines: Record<string, unknown>[];
  recurring_transactions: Record<string, unknown>[];
  recurring_lines: Record<string, unknown>[];
  reconciliations: Record<string, unknown>[];
  envelope_targets: Record<string, unknown>[];
  credit_limits: Record<string, unknown>[];
  loan_principals: Record<string, unknown>[];
};

type BackupBody = {
  version: number;
  exportedAt: string;
  householdId: string;
  tables: BackupTables;
};

const EXPECTED_TABLES: (keyof BackupTables)[] = [
  "households",
  "accounts",
  "envelopes",
  "transfers",
  "envelope_transfers",
  "transactions",
  "allocations",
  "templates",
  "template_lines",
  "recurring_transactions",
  "recurring_lines",
  "reconciliations",
  "envelope_targets",
  "credit_limits",
  "loan_principals",
];

describe("GET /export (FEAT-015a)", () => {
  test("returns 200 with Content-Disposition attachment and a valid JSON backup", async () => {
    await post("/accounts", {
      openedOn: "2026-07-02",
      name: "Checking",
      kind: "checking",
      startingBalance: "500.00",
    });
    await post("/envelopes", { name: "Rent" });

    const res = await get("/export");

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="budgeteer-backup-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers["content-type"]).toMatch(/application\/json/);

    const body = res.json<BackupBody>();
    expect(body.version).toBe(1);
    expect(body.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.householdId).toBeTruthy();

    for (const table of EXPECTED_TABLES) {
      expect(Array.isArray(body.tables[table]), `tables.${table} should be an array`).toBe(true);
    }
  });

  test("cents columns are numbers, not strings", async () => {
    await post("/accounts", {
      openedOn: "2026-07-02",
      name: "Savings",
      kind: "savings",
      startingBalance: "1234.56",
    });

    const body = (await get("/export")).json<BackupBody>();

    // The opening-balance transaction carries amount_cents = 123456
    const txns = body.tables.transactions;
    expect(txns.length).toBeGreaterThan(0);
    const txn = txns[0]!; // safe: length > 0 asserted above
    expect(typeof txn.amount_cents).toBe("number");
    expect(txn.amount_cents).toBe(123456);
  });

  test("empty database returns household row and empty arrays for all other tables", async () => {
    const body = (await get("/export")).json<BackupBody>();

    expect(body.tables.households).toHaveLength(1);
    expect(body.tables.accounts).toHaveLength(0);
    expect(body.tables.transactions).toHaveLength(0);
    expect(body.tables.envelopes).toHaveLength(0);
    expect(body.tables.allocations).toHaveLength(0);
  });

  test("backup includes seeded accounts, envelopes and allocations", async () => {
    const accountRes = await post("/accounts", {
      openedOn: "2026-07-02",
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    const accountId = accountRes.json<{ account: { id: string } }>().account.id;
    const envRes = await post("/envelopes", { name: "Groceries" });
    const envId = envRes.json<{ envelope: { id: string } }>().envelope.id;

    await post(`/accounts/${accountId}/transactions`, {
      kind: "deposit",
      amount: "100.00",
      occurredOn: "2026-07-02",
      allocations: [{ envelopeId: envId, amount: "100.00" }],
    });

    const body = (await get("/export")).json<BackupBody>();

    expect(body.tables.accounts.length).toBeGreaterThanOrEqual(1);
    expect(body.tables.transactions.length).toBeGreaterThanOrEqual(1);
    expect(body.tables.allocations.length).toBeGreaterThanOrEqual(1);
    const alloc = body.tables.allocations[0]!; // safe: length >= 1 asserted above
    expect(typeof alloc.amount_cents).toBe("number");
  });
});
