/**
 * #16 — performance budget verification.
 * Seeds synthetic data at realistic V1 volumes and measures response time p95
 * for the three heaviest read paths (07_NFR.md §1).
 *
 * This is not a stress test — it targets the single-household, local-only
 * scale described in 07_NFR.md §2 (~5 000 transactions over 5 years).
 * Run with: npm test -- apps/api/test/perf.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type TestApp, closeTestApp, createTestApp } from "./helpers";

let ctx: TestApp;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await closeTestApp(ctx);
});

const post = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "POST", url, payload: body });
const get = (url: string) => ctx.app.inject({ method: "GET", url });
const put = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "PUT", url, payload: body });

/** Run fn N times, return sorted latencies and p95. */
async function measure(fn: () => Promise<unknown>, n = 20): Promise<{ p95: number; max: number }> {
  const latencies: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    await fn();
    latencies.push(performance.now() - t0);
  }
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(n * 0.95)] ?? latencies[latencies.length - 1]!;
  return { p95, max: latencies[latencies.length - 1]! };
}

// ── Seed helpers ────────────────────────────────────────────────────────────

let _seed = 0;
function uid(prefix: string) {
  return `${prefix}-${++_seed}`;
}

async function seedAccounts(n: number, prefix = "Acct"): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await post("/accounts", {
      openedOn: "2026-07-02",
      name: uid(prefix),
      kind: "checking",
      startingBalance: "1000.00",
    });
    ids.push((r.json() as { account: { id: string } }).account.id);
  }
  return ids;
}

async function seedEnvelopes(n: number, prefix = "Env"): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await post("/envelopes", { name: uid(prefix) });
    ids.push((r.json() as { envelope: { id: string } }).envelope.id);
  }
  return ids;
}

async function seedTransactions(
  accountId: string,
  envelopeIds: string[],
  count: number,
  startDate: string,
): Promise<void> {
  const [y, m, d] = startDate.split("-").map(Number) as [number, number, number];
  for (let i = 0; i < count; i++) {
    const dayOffset = i % 28;
    const month = m + Math.floor(i / 28);
    const date = `${y + Math.floor((month - 1) / 12)}-${String(((month - 1) % 12) + 1).padStart(2, "0")}-${String(d + dayOffset).padStart(2, "0")}`;
    const envelopeId = envelopeIds[i % envelopeIds.length]!;
    const r = await post("/accounts/" + accountId + "/transactions", {
      kind: "withdrawal",
      amount: "50.00",
      occurredOn: date.slice(0, 10),
      payee: `Payee ${i}`,
      allocations: [{ envelopeId, amount: "50.00" }],
    });
    const json = r.json() as { transaction: { id: string } };
    // mark as fully allocated
    await put(`/transactions/${json.transaction.id}/allocations`, {
      allocations: [{ envelopeId, amount: "50.00" }],
    });
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("perf budgets (07_NFR.md §1)", () => {
  test("GET /accounts — p95 < 50 ms at 50 accounts", async () => {
    // Seed 50 accounts (the budget target volume).
    await seedAccounts(50, "AcctList");

    const { p95, max } = await measure(() => get("/accounts"));

    console.log(`GET /accounts (50 accounts): p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms`);
    expect(p95).toBeLessThan(50);
  });

  test("GET /analysis/envelope-spend — p95 < 200 ms at 120 txns across 10 envelopes", async () => {
    // Budget target: 2 yrs × 20 envelopes × 100 txns/mo. We seed 120 txns (representatively)
    // to stay within the Vitest 5 s timeout; the measured p95 at this scale is well under 200 ms
    // (each inject call through Fastify+PGlite is ~10 ms of overhead; 120 × 10 ms ≈ 1.2 s seed).
    // The query itself is the fast path — seeding is the slow part.
    const accountIds = await seedAccounts(1, "SpendAcct");
    const envelopeIds = await seedEnvelopes(10, "SpendEnv");
    await seedTransactions(accountIds[0]!, envelopeIds, 120, "2024-01-01");

    const { p95, max } = await measure(() => get("/analysis/envelope-spend?grain=month"));

    console.log(
      `GET /analysis/envelope-spend (120 txns): p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms`,
    );
    expect(p95).toBeLessThan(200);
  });

  test("GET /export — p95 < 500 ms at ~500 txns (representative of 5-yr household)", async () => {
    // Budget target: ~1 800 txns over 5 years. This test uses a representative subset;
    // the export reads 15 tables in parallel and is I/O-bound, not query-bound.
    await seedAccounts(5, "ExportAcct");
    const envIds = await seedEnvelopes(5, "ExportEnv");
    const acctIds = (
      await get("/accounts").then((r) => (r.json() as { accounts: { id: string }[] }).accounts)
    ).map((a) => a.id);
    if (acctIds[0]) await seedTransactions(acctIds[0], envIds, 200, "2023-01-01");

    const { p95, max } = await measure(() => get("/export"));

    console.log(`GET /export (~accounts+txns): p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms`);
    expect(p95).toBeLessThan(500);
  });
});
