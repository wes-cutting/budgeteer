import {
  type AccountView,
  type Api,
  ApiError,
  type EnvelopeView,
  type TransactionView,
} from "../api";
import { parseCents } from "../format";

/**
 * An in-memory fake of the API for component tests — mirrors the server's derived balances and
 * the split invariant (signs by direction; account balance = Σ txns; envelope balance = Σ allocations).
 */
export function makeFakeApi(overrides: Partial<Api> = {}): Api {
  const accounts: AccountView[] = [];
  const envelopes: EnvelopeView[] = [];
  const txns: TransactionView[] = [];
  let seq = 0;
  const newId = (p: string) => `${p}${seq++}`;
  const envName = (id: string) => envelopes.find((e) => e.id === id)?.name ?? "?";
  const clone = (t: TransactionView): TransactionView => ({
    ...t,
    allocations: t.allocations.map((a) => ({ ...a })),
  });

  function recompute() {
    for (const a of accounts) {
      a.balanceCents = txns
        .filter((t) => t.accountId === a.id)
        .reduce((s, t) => s + t.amountCents, 0);
    }
    for (const e of envelopes) {
      e.balanceCents = txns
        .flatMap((t) => t.allocations)
        .filter((al) => al.envelopeId === e.id)
        .reduce((s, al) => s + al.amountCents, 0);
    }
    for (const t of txns) {
      t.allocatedCents = t.allocations.reduce((s, al) => s + al.amountCents, 0);
      t.unallocatedCents = t.amountCents - t.allocatedCents;
    }
  }

  function makeTxn(
    account: AccountView,
    kind: "opening" | "normal",
    amountCents: number,
    payee: string | null,
    allocations: { envelopeId: string; amountCents: number }[],
    occurredOn = "2026-06-13",
  ): TransactionView {
    return {
      id: newId("t"),
      accountId: account.id,
      accountName: account.name,
      kind,
      amountCents,
      occurredOn,
      payee,
      memo: null,
      allocations: allocations.map((a) => ({
        id: newId("al"),
        envelopeId: a.envelopeId,
        envelopeName: envName(a.envelopeId),
        amountCents: a.amountCents,
      })),
      allocatedCents: 0,
      unallocatedCents: 0,
    };
  }

  const api: Api = {
    async listAccounts() {
      recompute();
      return accounts.map((a) => ({ ...a }));
    },
    async createAccount({ name, kind, startingBalance }) {
      const account: AccountView = {
        id: newId("a"),
        name,
        kind,
        balanceCents: 0,
        archivedAt: null,
      };
      accounts.push(account);
      txns.push(makeTxn(account, "opening", parseCents(startingBalance) ?? 0, null, []));
      recompute();
      return { ...account };
    },
    async listEnvelopes() {
      recompute();
      return envelopes.map((e) => ({ ...e }));
    },
    async createEnvelope({ name, kind }) {
      const envelope: EnvelopeView = {
        id: newId("e"),
        name,
        kind,
        balanceCents: 0,
        archivedAt: null,
      };
      envelopes.push(envelope);
      return { ...envelope };
    },
    async listTransactions(accountId) {
      recompute();
      return txns.filter((t) => t.accountId === accountId).map(clone);
    },
    async createTransaction(accountId, input) {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) throw new ApiError("Account not found.");
      const sign = input.kind === "deposit" ? 1 : -1;
      const amount = (parseCents(input.amount) ?? 0) * sign;
      const allocations = input.allocations.map((d) => ({
        envelopeId: d.envelopeId,
        amountCents: (parseCents(d.amount) ?? 0) * sign,
      }));
      const txn = makeTxn(
        account,
        "normal",
        amount,
        input.payee ?? null,
        allocations,
        input.occurredOn,
      );
      txns.push(txn);
      recompute();
      return clone(txn);
    },
    async setAllocations(transactionId, allocations) {
      const txn = txns.find((t) => t.id === transactionId);
      if (!txn) throw new ApiError("Transaction not found.");
      const sign = txn.amountCents >= 0 ? 1 : -1;
      txn.allocations = allocations.map((d) => ({
        id: newId("al"),
        envelopeId: d.envelopeId,
        envelopeName: envName(d.envelopeId),
        amountCents: (parseCents(d.amount) ?? 0) * sign,
      }));
      recompute();
      return clone(txn);
    },
    async listNeedsAllocation() {
      recompute();
      return txns.filter((t) => t.unallocatedCents !== 0).map(clone);
    },
    ...overrides,
  };
  return api;
}
