// THROWAWAY spike test (SPIKE-04). Asserts the candidate representation against every
// invariant the modeling decision rests on. Run: `npm test` (node --import tsx --test).

import test from "node:test";
import assert from "node:assert/strict";
import { cents } from "./money";
import {
  accountBalance,
  accountTransfer,
  addAccount,
  addEnvelope,
  addTransaction,
  deleteAccountTransfer,
  emptyLedger,
  envelopeBalance,
  envelopeTransfer,
  needsAllocation,
  totalAccountMoney,
  totalEnvelopeMoney,
} from "./model";

// A small seeded world: two accounts (one funded), two envelopes split from the deposit.
function seeded() {
  const l = emptyLedger();
  addAccount(l, "checking");
  addAccount(l, "savings");
  addEnvelope(l, "groceries");
  addEnvelope(l, "vacation");
  // $1,000 deposit into checking, split $600 groceries / $400 vacation (fully allocated).
  addTransaction(l, "checking", cents(100000), [
    { envelopeId: "groceries", amountCents: cents(60000) },
    { envelopeId: "vacation", amountCents: cents(40000) },
  ]);
  return l;
}

test("(A) account transfer: moves account money, conserves the total, leaves envelopes untouched", () => {
  const l = seeded();
  const beforeTotal = totalAccountMoney(l);
  const beforeGroceries = envelopeBalance(l, "groceries");
  const beforeVacation = envelopeBalance(l, "vacation");

  accountTransfer(l, "checking", "savings", cents(25000)); // move $250 checking → savings

  assert.equal(accountBalance(l, "checking"), 75000); // $1000 − $250
  assert.equal(accountBalance(l, "savings"), 25000); // $0 + $250
  assert.equal(totalAccountMoney(l), beforeTotal); // nothing created/destroyed
  // Envelopes are ORTHOGONAL — physical relocation does not re-budget anything.
  assert.equal(envelopeBalance(l, "groceries"), beforeGroceries);
  assert.equal(envelopeBalance(l, "vacation"), beforeVacation);
});

test("(A) transfer legs are EXEMPT from needs-allocation (relocated money is already budgeted)", () => {
  const l = emptyLedger();
  addAccount(l, "checking");
  addAccount(l, "savings");
  // No deposits → no needs-allocation. A transfer must not create phantom needs-allocation rows.
  accountTransfer(l, "checking", "savings", cents(5000));
  assert.equal(needsAllocation(l).length, 0);
  // Sanity: a normal unallocated deposit DOES still surface.
  addTransaction(l, "checking", cents(3000)); // unsplit
  assert.equal(needsAllocation(l).length, 1);
});

test("(B) envelope transfer: moves budgeted money, conserves the total, leaves accounts untouched", () => {
  const l = seeded();
  const beforeChecking = accountBalance(l, "checking");
  const beforeEnvTotal = totalEnvelopeMoney(l);

  envelopeTransfer(l, "groceries", "vacation", cents(15000)); // re-budget $150 groceries → vacation

  assert.equal(envelopeBalance(l, "groceries"), 45000); // $600 − $150
  assert.equal(envelopeBalance(l, "vacation"), 55000); // $400 + $150
  assert.equal(totalEnvelopeMoney(l), beforeEnvTotal); // budgeted total conserved
  // Accounts are ORTHOGONAL — no transaction was created.
  assert.equal(accountBalance(l, "checking"), beforeChecking);
  assert.equal(totalAccountMoney(l), 100000);
  assert.equal(needsAllocation(l).length, 0); // the existing split is undisturbed
});

test("(A+B) compose without double-counting: 'send $200 checking→savings AND re-budget groceries→vacation'", () => {
  const l = seeded();
  // The owner's stated need: account move AND envelope move, as two orthogonal primitives.
  accountTransfer(l, "checking", "savings", cents(20000));
  envelopeTransfer(l, "groceries", "vacation", cents(20000));

  assert.equal(accountBalance(l, "checking"), 80000);
  assert.equal(accountBalance(l, "savings"), 20000);
  assert.equal(envelopeBalance(l, "groceries"), 40000);
  assert.equal(envelopeBalance(l, "vacation"), 60000);
  // Whole-system conservation holds on BOTH axes independently.
  assert.equal(totalAccountMoney(l), 100000);
  assert.equal(totalEnvelopeMoney(l), 100000);
});

test("exactness with odd cents on both axes (no float drift)", () => {
  const l = seeded();
  accountTransfer(l, "checking", "savings", cents(3333));
  envelopeTransfer(l, "vacation", "groceries", cents(1717));
  assert.equal(accountBalance(l, "checking"), 96667);
  assert.equal(accountBalance(l, "savings"), 3333);
  assert.equal(envelopeBalance(l, "groceries"), 61717);
  assert.equal(envelopeBalance(l, "vacation"), 38283);
  assert.equal(totalAccountMoney(l), 100000);
  assert.equal(totalEnvelopeMoney(l), 100000);
});

test("deleting an account transfer removes BOTH legs atomically and restores balances", () => {
  const l = seeded();
  const xfer = accountTransfer(l, "checking", "savings", cents(25000));
  assert.equal(l.transactions.filter((t) => t.transferId === xfer.id).length, 2);
  deleteAccountTransfer(l, xfer.id);
  assert.equal(l.transactions.filter((t) => t.transferId === xfer.id).length, 0);
  assert.equal(accountBalance(l, "checking"), 100000);
  assert.equal(accountBalance(l, "savings"), 0);
});

test("an envelope can be drained to exactly 0, then is safe to archive (the deferred #6 synergy)", () => {
  const l = seeded();
  envelopeTransfer(l, "vacation", "groceries", cents(40000)); // drain vacation's whole $400
  assert.equal(envelopeBalance(l, "vacation"), 0);
  assert.equal(envelopeBalance(l, "groceries"), 100000);
});

test("guard rails reject bad input at the boundary", () => {
  const l = seeded();
  addEnvelope(l, "archived-env", "2026-06-14");
  assert.throws(() => accountTransfer(l, "checking", "checking", cents(100)), /same account/);
  assert.throws(() => envelopeTransfer(l, "groceries", "groceries", cents(100)), /same envelope/);
  assert.throws(() => accountTransfer(l, "checking", "savings", cents(0)), /positive magnitude/);
  assert.throws(() => accountTransfer(l, "checking", "savings", cents(-5)), /positive magnitude/);
  assert.throws(() => envelopeTransfer(l, "groceries", "archived-env", cents(100)), /archived/);
  // …but draining FROM an archived envelope is allowed (move remaining balance out before archive).
  assert.doesNotThrow(() => envelopeTransfer(l, "archived-env", "groceries", cents(0 + 1)));
});
