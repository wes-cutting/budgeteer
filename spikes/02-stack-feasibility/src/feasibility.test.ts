// THROWAWAY spike tests (SPIKE-02). Proves at runtime that integer money + the split
// invariant are EXACT in TypeScript — the prior float attempt's failure point.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  parseMoney,
  formatMoney,
  sumMoney,
  splitEvenly,
  splitByWeights,
  lastRowRemainder,
} from "./money";
import {
  type Allocation,
  type Transaction,
  type TransactionRepository,
  allocatedTotal,
  unallocated,
  isFullyAllocated,
  validateAllocations,
} from "./allocation";

const ENVELOPES = [
  "Rent", "Mortgage", "Auto", "Groceries", "Utils", "Gas",
  "Savings", "ISPs", "Phone", "Dine Out", "Debt", "Extras",
];

test("parse/format round-trips at the boundary; no floats leak", () => {
  assert.equal(parseMoney("3200.00"), 320000);
  assert.equal(parseMoney("-31.25"), -3125);
  assert.equal(parseMoney("0.07"), 7);
  assert.equal(parseMoney("5"), 500);
  assert.equal(formatMoney(cents(320000)), "3200.00");
  assert.equal(formatMoney(cents(7)), "0.07");
  assert.equal(formatMoney(cents(-3125)), "-31.25");
  // the classic float trap, now exact:
  assert.equal(sumMoney([parseMoney("0.10"), parseMoney("0.20")]), parseMoney("0.30"));
});

test("invalid money input fails loudly", () => {
  for (const bad of ["12.345", "1,234.00", "abc", "", "$5", "1.2.3"]) {
    assert.throws(() => parseMoney(bad), /Invalid money input/, `should reject "${bad}"`);
  }
  assert.throws(() => cents(33.5), /whole cents/);
});

test("splitEvenly: odd cents distribute exactly (100c / 3 = 34+33+33)", () => {
  const parts = splitEvenly(cents(100), 3);
  assert.deepEqual(parts, [34, 33, 33]);
  assert.equal(sumMoney(parts), 100);
  // a withdrawal (negative) splits exactly too
  const w = splitEvenly(cents(-21400), 3);
  assert.equal(sumMoney(w), -21400);
  assert.ok(Math.max(...w) - Math.min(...w) <= 1);
});

test("splitByWeights: a 12-envelope percentage paycheck split sums EXACTLY", () => {
  const paycheck = parseMoney("3200.00"); // 320000c
  const weights = [22, 14, 9, 8, 6, 5, 12, 4, 3, 9, 5, 3]; // 12 weights, arbitrary
  assert.equal(weights.length, ENVELOPES.length);
  const parts = splitByWeights(paycheck, weights);
  assert.equal(parts.length, 12);
  assert.equal(sumMoney(parts), paycheck); // <-- the invariant, to the cent
  // a deliberately remainder-heavy case:
  const tricky = splitByWeights(cents(100), [1, 1, 1]);
  assert.equal(sumMoney(tricky), 100);
});

test("lastRowRemainder: the SPIKE-01 store-run rule sums EXACTLY", () => {
  const target = parseMoney("-214.00"); // a $214 withdrawal
  const known = [parseMoney("-160.00"), parseMoney("-40.00")];
  const last = lastRowRemainder(target, known);
  assert.equal(last, parseMoney("-14.00"));
  assert.equal(sumMoney([...known, last]), target);
});

test("partial allocation is first-class: save now, split later", () => {
  const paycheck = parseMoney("3200.00");
  const partial: Transaction = {
    id: "t1",
    accountId: "checking",
    amount: paycheck,
    allocations: [
      { envelopeId: "Rent", amount: parseMoney("1400.00") },
      { envelopeId: "Groceries", amount: parseMoney("600.00") },
    ],
  };
  assert.equal(allocatedTotal(partial), parseMoney("2000.00"));
  assert.equal(unallocated(partial), parseMoney("1200.00")); // surfaced as "needs allocation"
  assert.equal(isFullyAllocated(partial), false);
  assert.deepEqual(validateAllocations(partial), { ok: true });

  // finish it later with the remainder rule -> exactly zero unallocated
  const remainder: Allocation = { envelopeId: "Savings", amount: unallocated(partial) };
  const done: Transaction = { ...partial, allocations: [...partial.allocations, remainder] };
  assert.equal(unallocated(done), 0);
  assert.equal(isFullyAllocated(done), true);
});

test("over-allocation is rejected; sign rules hold", () => {
  const over: Transaction = {
    id: "t2", accountId: "checking", amount: parseMoney("100.00"),
    allocations: [{ envelopeId: "Extras", amount: parseMoney("150.00") }],
  };
  assert.equal(validateAllocations(over).ok, false);
});

test("repository PORT (impure-shell seam) type-checks and round-trips in memory", async () => {
  // An in-memory adapter standing in for the future Postgres/Kysely adapter — proves the
  // pure core depends only on the interface, with zero I/O in the domain.
  class InMemoryRepo implements TransactionRepository {
    private readonly store = new Map<string, Transaction>();
    async save(txn: Transaction) { this.store.set(txn.id, txn); }
    async get(id: string) { return this.store.get(id); }
    async listNeedingAllocation() {
      return [...this.store.values()].filter((t) => !isFullyAllocated(t));
    }
  }
  const repo: TransactionRepository = new InMemoryRepo();
  const txn: Transaction = {
    id: "t3", accountId: "checking", amount: parseMoney("-48.20"),
    allocations: [{ envelopeId: "Gas", amount: parseMoney("-48.20") }],
  };
  await repo.save(txn);
  assert.deepEqual(await repo.get("t3"), txn);
  assert.equal((await repo.listNeedingAllocation()).length, 0);
});
