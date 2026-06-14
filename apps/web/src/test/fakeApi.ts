import {
  type AccountView,
  type Api,
  ApiError,
  type EnvelopeTransferView,
  type EnvelopeView,
  type TemplateView,
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
  const envelopeTransfers: EnvelopeTransferView[] = [];
  const templates: TemplateView[] = [];
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
      const fromAllocations = txns
        .flatMap((t) => t.allocations)
        .filter((al) => al.envelopeId === e.id)
        .reduce((s, al) => s + al.amountCents, 0);
      const incoming = envelopeTransfers
        .filter((et) => et.to.envelopeId === e.id)
        .reduce((s, et) => s + et.amountCents, 0);
      const outgoing = envelopeTransfers
        .filter((et) => et.from.envelopeId === e.id)
        .reduce((s, et) => s + et.amountCents, 0);
      e.balanceCents = fromAllocations + incoming - outgoing;
    }
    for (const t of txns) {
      t.allocatedCents = t.allocations.reduce((s, al) => s + al.amountCents, 0);
      t.unallocatedCents = t.amountCents - t.allocatedCents;
    }
  }

  function makeTxn(
    account: AccountView,
    kind: "opening" | "normal" | "transfer",
    amountCents: number,
    payee: string | null,
    allocations: { envelopeId: string; amountCents: number }[],
    occurredOn = "2026-06-13",
    transfer: { id: string; counterpartName: string } | null = null,
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
      transferId: transfer?.id ?? null,
      transferCounterpartName: transfer?.counterpartName ?? null,
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
    async archiveEnvelope(id) {
      const envelope = envelopes.find((e) => e.id === id);
      if (!envelope) throw new ApiError("Envelope not found.");
      envelope.archivedAt = new Date().toISOString();
      return { ...envelope };
    },
    async unarchiveEnvelope(id) {
      const envelope = envelopes.find((e) => e.id === id);
      if (!envelope) throw new ApiError("Envelope not found.");
      envelope.archivedAt = null;
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
        amountCents: (parseCents(d.amount) ?? 0) * (d.refund ? -sign : sign),
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
    async createTransfer({ fromAccountId, toAccountId, amount, occurredOn, memo }) {
      const from = accounts.find((a) => a.id === fromAccountId);
      const to = accounts.find((a) => a.id === toAccountId);
      if (!from || !to) throw new ApiError("Account not found.");
      if (from.id === to.id) throw new ApiError("Choose two different accounts.");
      const magnitude = parseCents(amount) ?? 0;
      if (magnitude <= 0) throw new ApiError("Enter an amount greater than 0.");
      const id = newId("xfer");
      const on = occurredOn ?? "2026-06-13";
      const outLeg = makeTxn(from, "transfer", -magnitude, null, [], on, {
        id,
        counterpartName: to.name,
      });
      const inLeg = makeTxn(to, "transfer", magnitude, null, [], on, {
        id,
        counterpartName: from.name,
      });
      txns.push(outLeg, inLeg);
      recompute();
      return {
        id,
        occurredOn: on,
        memo: memo ?? null,
        amountCents: magnitude,
        from: {
          transactionId: outLeg.id,
          accountId: from.id,
          accountName: from.name,
          amountCents: -magnitude,
        },
        to: {
          transactionId: inLeg.id,
          accountId: to.id,
          accountName: to.name,
          amountCents: magnitude,
        },
      };
    },
    async createEnvelopeTransfer({ fromEnvelopeId, toEnvelopeId, amount, occurredOn, memo }) {
      const from = envelopes.find((e) => e.id === fromEnvelopeId);
      const to = envelopes.find((e) => e.id === toEnvelopeId);
      if (!from || !to) throw new ApiError("Envelope not found.");
      if (from.id === to.id) throw new ApiError("Choose two different envelopes.");
      if (to.archivedAt !== null) throw new ApiError("That envelope is archived.");
      const magnitude = parseCents(amount) ?? 0;
      if (magnitude <= 0) throw new ApiError("Enter an amount greater than 0.");
      const et: EnvelopeTransferView = {
        id: newId("etr"),
        occurredOn: occurredOn ?? "2026-06-13",
        memo: memo ?? null,
        amountCents: magnitude,
        from: { envelopeId: from.id, envelopeName: from.name },
        to: { envelopeId: to.id, envelopeName: to.name },
      };
      envelopeTransfers.push(et);
      recompute();
      return { ...et, from: { ...et.from }, to: { ...et.to } };
    },
    async setAllocations(transactionId, allocations) {
      const txn = txns.find((t) => t.id === transactionId);
      if (!txn) throw new ApiError("Transaction not found.");
      const sign = txn.amountCents >= 0 ? 1 : -1;
      txn.allocations = allocations.map((d) => ({
        id: newId("al"),
        envelopeId: d.envelopeId,
        envelopeName: envName(d.envelopeId),
        amountCents: (parseCents(d.amount) ?? 0) * (d.refund ? -sign : sign),
      }));
      recompute();
      return clone(txn);
    },
    async listNeedsAllocation() {
      recompute();
      return txns.filter((t) => t.kind !== "transfer" && t.unallocatedCents !== 0).map(clone);
    },
    async listTemplates() {
      return templates.map((t) => ({ ...t, lines: t.lines.map((l) => ({ ...l })) }));
    },
    async createTemplate({ name, lines }) {
      if (templates.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        throw new ApiError("A template with that name already exists.");
      }
      const tpl: TemplateView = {
        id: newId("tpl"),
        name,
        lines: lines.map((l) => ({
          id: newId("tl"),
          envelopeId: l.envelopeId,
          envelopeName: envName(l.envelopeId),
          amountCents: parseCents(l.amount) ?? 0,
        })),
      };
      templates.push(tpl);
      return { ...tpl, lines: tpl.lines.map((l) => ({ ...l })) };
    },
    async updateTemplate(id, { name, lines }) {
      const tpl = templates.find((t) => t.id === id);
      if (!tpl) throw new ApiError("Template not found.");
      tpl.name = name;
      tpl.lines = lines.map((l) => ({
        id: newId("tl"),
        envelopeId: l.envelopeId,
        envelopeName: envName(l.envelopeId),
        amountCents: parseCents(l.amount) ?? 0,
      }));
      return { ...tpl, lines: tpl.lines.map((l) => ({ ...l })) };
    },
    async deleteTemplate(id) {
      const idx = templates.findIndex((t) => t.id === id);
      if (idx >= 0) templates.splice(idx, 1);
    },
    ...overrides,
  };
  return api;
}
