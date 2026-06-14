// THROWAWAY spike code (SPIKE-04). The question: can we represent BOTH movement types the
// owner needs — (A) account↔account transfers and (B) envelope↔envelope reallocation — so
// that every existing balance invariant still holds EXACTLY, the two are ORTHOGONAL (an
// account move never touches an envelope balance and vice-versa), and the existing split
// model is left undisturbed?
//
// Candidate representation under test:
//   A — Account transfer = a `Transfer` parent + TWO linked `Transaction`s of kind "transfer"
//       (one −X on the from-account, one +X on the to-account), carrying NO allocations and
//       EXEMPT from the needs-allocation surface. Account balance derivation is unchanged
//       (it already sums all of an account's transactions); envelopes are untouched.
//   B — Envelope transfer = a dedicated `EnvelopeTransfer` row (from, to, positive magnitude).
//       It never creates an account transaction. Envelope balance becomes:
//         Σ allocations  +  Σ incoming envelope-transfers  −  Σ outgoing envelope-transfers.
//       Account balances are untouched; the transaction split invariant is undisturbed.
//
// This is the minimal ADDITIVE change: it extends the two derivations without altering the
// allocation/split model already built (#3–#6).

import { type Cents, cents, sum } from "./money";

// ── Entities (trimmed to what the modeling question needs) ──────────────────────────────

export interface Account {
  readonly id: string;
  readonly archivedAt: string | null;
}
export interface Envelope {
  readonly id: string;
  readonly archivedAt: string | null;
}

export const TXN_KINDS = ["opening", "normal", "transfer"] as const;
export type TxnKind = (typeof TXN_KINDS)[number];

export interface Transaction {
  readonly id: string;
  readonly accountId: string;
  readonly amountCents: Cents; // signed
  readonly kind: TxnKind;
  /** Set iff kind === "transfer"; both legs of a transfer share one transferId. */
  readonly transferId: string | null;
}

export interface Allocation {
  readonly id: string;
  readonly transactionId: string;
  readonly envelopeId: string;
  readonly amountCents: Cents; // signed, shares its transaction's sign
}

/** (A) The parent that links the two legs and would home shared metadata (date/memo). */
export interface Transfer {
  readonly id: string;
}

/** (B) An envelope→envelope reallocation. Touches NO account. Magnitude is positive. */
export interface EnvelopeTransfer {
  readonly id: string;
  readonly fromEnvelopeId: string;
  readonly toEnvelopeId: string;
  readonly amountCents: Cents; // positive magnitude
}

export interface Ledger {
  accounts: Account[];
  envelopes: Envelope[];
  transactions: Transaction[];
  allocations: Allocation[];
  transfers: Transfer[];
  envelopeTransfers: EnvelopeTransfer[];
}

export const emptyLedger = (): Ledger => ({
  accounts: [],
  envelopes: [],
  transactions: [],
  allocations: [],
  transfers: [],
  envelopeTransfers: [],
});

// ── Derivations (derive-don't-store; the only two that change vs. today) ─────────────────

/** Unchanged from today: an account's balance is the signed sum of ALL its transactions
 *  (opening + normal + transfer legs all count — a transfer leg is real money moving). */
export function accountBalance(l: Ledger, accountId: string): Cents {
  return sum(l.transactions.filter((t) => t.accountId === accountId).map((t) => t.amountCents));
}

/** EXTENDED: allocations (as today) PLUS net envelope-transfer flow. Still fully derived. */
export function envelopeBalance(l: Ledger, envelopeId: string): Cents {
  const fromAllocations = l.allocations
    .filter((a) => a.envelopeId === envelopeId)
    .map((a) => a.amountCents);
  const incoming = l.envelopeTransfers
    .filter((e) => e.toEnvelopeId === envelopeId)
    .map((e) => e.amountCents);
  const outgoing = l.envelopeTransfers
    .filter((e) => e.fromEnvelopeId === envelopeId)
    .map((e) => -e.amountCents);
  return sum([...fromAllocations, ...incoming, ...outgoing]);
}

/** Whole-system totals — used to assert conservation (nothing created/destroyed by a move). */
export const totalAccountMoney = (l: Ledger): Cents =>
  sum(l.transactions.map((t) => t.amountCents));
export const totalEnvelopeMoney = (l: Ledger): Cents =>
  sum(l.envelopes.map((e) => envelopeBalance(l, e.id)));

/** A transaction's unallocated remainder (today's definition; transfer legs are excluded below). */
function unallocated(l: Ledger, txn: Transaction): Cents {
  const allocated = sum(
    l.allocations.filter((a) => a.transactionId === txn.id).map((a) => a.amountCents),
  );
  return cents(txn.amountCents - allocated);
}

/** CHANGED: needs-allocation now EXCLUDES transfer legs — relocated money is already budgeted. */
export function needsAllocation(l: Ledger): Transaction[] {
  return l.transactions.filter((t) => t.kind !== "transfer" && unallocated(l, t) !== 0);
}

// ── Operations (validation at the boundary; invalid input fails loudly) ──────────────────

let seq = 0;
const nextId = (prefix: string): string => `${prefix}-${++seq}`;

const liveAccount = (l: Ledger, id: string): Account => {
  const a = l.accounts.find((x) => x.id === id);
  if (!a) throw new Error(`unknown account: ${id}`);
  return a;
};
const findEnvelope = (l: Ledger, id: string): Envelope => {
  const e = l.envelopes.find((x) => x.id === id);
  if (!e) throw new Error(`unknown envelope: ${id}`);
  return e;
};

/** (A) Move physical money between two accounts. Returns the parent transfer. */
export function accountTransfer(
  l: Ledger,
  fromAccountId: string,
  toAccountId: string,
  magnitude: Cents,
): Transfer {
  if (magnitude <= 0) throw new Error("transfer amount must be a positive magnitude");
  if (fromAccountId === toAccountId) throw new Error("cannot transfer to the same account");
  liveAccount(l, fromAccountId);
  liveAccount(l, toAccountId);

  const transfer: Transfer = { id: nextId("xfer") };
  l.transfers.push(transfer);
  // Atomic pair: −X out of `from`, +X into `to`. Both kind "transfer", no allocations.
  l.transactions.push(
    {
      id: nextId("txn"),
      accountId: fromAccountId,
      amountCents: cents(-magnitude),
      kind: "transfer",
      transferId: transfer.id,
    },
    {
      id: nextId("txn"),
      accountId: toAccountId,
      amountCents: cents(magnitude),
      kind: "transfer",
      transferId: transfer.id,
    },
  );
  return transfer;
}

/** (B) Move budgeted money between two envelopes. Touches no account. */
export function envelopeTransfer(
  l: Ledger,
  fromEnvelopeId: string,
  toEnvelopeId: string,
  magnitude: Cents,
): EnvelopeTransfer {
  if (magnitude <= 0) throw new Error("transfer amount must be a positive magnitude");
  if (fromEnvelopeId === toEnvelopeId) throw new Error("cannot transfer to the same envelope");
  findEnvelope(l, fromEnvelopeId); // a `from` MAY be archived — draining before archive is valid
  const to = findEnvelope(l, toEnvelopeId);
  if (to.archivedAt !== null) throw new Error("cannot transfer into an archived envelope");

  const et: EnvelopeTransfer = {
    id: nextId("etr"),
    fromEnvelopeId,
    toEnvelopeId,
    amountCents: magnitude,
  };
  l.envelopeTransfers.push(et);
  return et;
}

/** Deleting an account transfer removes BOTH legs (atomic pair) — modeled for completeness. */
export function deleteAccountTransfer(l: Ledger, transferId: string): void {
  l.transactions = l.transactions.filter((t) => t.transferId !== transferId);
  l.transfers = l.transfers.filter((t) => t.id !== transferId);
}

// ── Tiny builders for the scenario tests ─────────────────────────────────────────────────

export function addAccount(l: Ledger, id: string, archivedAt: string | null = null): Account {
  const a: Account = { id, archivedAt };
  l.accounts.push(a);
  return a;
}
export function addEnvelope(l: Ledger, id: string, archivedAt: string | null = null): Envelope {
  const e: Envelope = { id, archivedAt };
  l.envelopes.push(e);
  return e;
}
/** A normal deposit/withdrawal with optional splits (the existing model, used as a baseline). */
export function addTransaction(
  l: Ledger,
  accountId: string,
  amount: Cents,
  splits: ReadonlyArray<{ envelopeId: string; amountCents: Cents }> = [],
  kind: TxnKind = "normal",
): Transaction {
  const txn: Transaction = {
    id: nextId("txn"),
    accountId,
    amountCents: amount,
    kind,
    transferId: null,
  };
  l.transactions.push(txn);
  for (const s of splits) {
    l.allocations.push({
      id: nextId("alloc"),
      transactionId: txn.id,
      envelopeId: s.envelopeId,
      amountCents: s.amountCents,
    });
  }
  return txn;
}
