import { anchorDayOf, dueOccurrences, tryParseMoney } from "@budgeteer/domain";
import {
  type AccountView,
  type Api,
  ApiError,
  type EnvelopeTransferView,
  type EnvelopeView,
  type ReconciliationView,
  type RecurringView,
  type TemplateView,
  type TransactionView,
} from "../api";

/**
 * An in-memory fake of the API for component tests — mirrors the server's derived balances and
 * the split invariant (signs by direction; account balance = Σ txns; envelope balance = Σ allocations).
 */
export function makeFakeApi(overrides: Partial<Api> = {}): Api {
  const accounts: AccountView[] = [];
  const envelopes: EnvelopeView[] = [];
  const txns: TransactionView[] = [];
  const envelopeTransfers: EnvelopeTransferView[] = [];
  const recurrings: RecurringView[] = [];
  const reconciliations: ReconciliationView[] = [];
  const templates: TemplateView[] = [];
  const targets = new Map<string, number>(); // envelopeId → monthly target cents (FEAT-012)
  const today = () => new Date().toISOString().slice(0, 10);
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
      recurringId: null,
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
      txns.push(makeTxn(account, "opening", tryParseMoney(startingBalance) ?? 0, null, []));
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
      const amount = (tryParseMoney(input.amount) ?? 0) * sign;
      const allocations = input.allocations.map((d) => ({
        envelopeId: d.envelopeId,
        amountCents: (tryParseMoney(d.amount) ?? 0) * (d.refund ? -sign : sign),
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
      const magnitude = tryParseMoney(amount) ?? 0;
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
      const magnitude = tryParseMoney(amount) ?? 0;
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
        amountCents: (tryParseMoney(d.amount) ?? 0) * (d.refund ? -sign : sign),
      }));
      recompute();
      return clone(txn);
    },
    async listNeedsAllocation() {
      recompute();
      return txns.filter((t) => t.kind !== "transfer" && t.unallocatedCents !== 0).map(clone);
    },
    async listRecurring() {
      const t = today();
      return recurrings.map((r) => ({
        ...r,
        dueCount: dueOccurrences(r.nextOccurrenceOn, t, r.frequency, anchorDayOf(r.anchorOn)).dates
          .length,
        lines: r.lines.map((l) => ({ ...l })),
      }));
    },
    async createRecurring({ accountId, kind, amount, payee, memo, frequency, anchorOn, lines }) {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) throw new ApiError("Account not found.");
      if (lines.length === 0) throw new ApiError("Add at least one split line.");
      const rule: RecurringView = {
        id: newId("rec"),
        accountId,
        accountName: account.name,
        direction: kind,
        amountCents: tryParseMoney(amount) ?? 0,
        payee: payee ?? null,
        memo: memo ?? null,
        frequency,
        anchorOn,
        nextOccurrenceOn: anchorOn,
        dueCount: 0,
        lines: lines.map((l) => ({
          id: newId("rl"),
          envelopeId: l.envelopeId,
          envelopeName: envName(l.envelopeId),
          amountCents: tryParseMoney(l.amount) ?? 0,
          refund: l.refund ?? false,
        })),
      };
      recurrings.push(rule);
      return { ...rule, lines: rule.lines.map((l) => ({ ...l })) };
    },
    async deleteRecurring(id) {
      const i = recurrings.findIndex((r) => r.id === id);
      if (i < 0) throw new ApiError("Recurring rule not found.");
      recurrings.splice(i, 1);
    },
    async postDueRecurring() {
      const t = today();
      let posted = 0;
      const rules: { recurringId: string; posted: number; error?: string }[] = [];
      for (const r of recurrings) {
        const account = accounts.find((a) => a.id === r.accountId);
        const due = dueOccurrences(r.nextOccurrenceOn, t, r.frequency, anchorDayOf(r.anchorOn));
        if (due.dates.length === 0 || !account) continue;
        const sign = r.direction === "deposit" ? 1 : -1;
        for (const date of due.dates) {
          const txn = makeTxn(
            account,
            "normal",
            r.amountCents * sign,
            r.payee,
            r.lines.map((l) => ({
              envelopeId: l.envelopeId,
              amountCents: l.amountCents * (l.refund ? -sign : sign),
            })),
            date,
          );
          txn.recurringId = r.id;
          txns.push(txn);
        }
        r.nextOccurrenceOn = due.nextCursor;
        posted += due.dates.length;
        rules.push({ recurringId: r.id, posted: due.dates.length });
      }
      recompute();
      return { posted, rules };
    },
    async listReconciliations(accountId) {
      return reconciliations
        .filter((r) => r.accountId === accountId)
        .slice()
        .sort((a, b) => (a.reconciledOn < b.reconciledOn ? 1 : -1))
        .map((r) => ({ ...r }));
    },
    async createReconciliation(accountId, { statementBalance, reconciledOn }) {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) throw new ApiError("Account not found.");
      recompute();
      const derived = account.balanceCents;
      const statement = tryParseMoney(statementBalance) ?? 0;
      const rec: ReconciliationView = {
        id: newId("rec"),
        accountId,
        statementBalanceCents: statement,
        derivedBalanceCents: derived,
        differenceCents: statement - derived,
        matched: statement - derived === 0,
        reconciledOn: reconciledOn ?? "2026-06-15",
      };
      reconciliations.push(rec);
      return { ...rec };
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
          amountCents: tryParseMoney(l.amount) ?? 0,
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
        amountCents: tryParseMoney(l.amount) ?? 0,
      }));
      return { ...tpl, lines: tpl.lines.map((l) => ({ ...l })) };
    },
    async deleteTemplate(id) {
      const idx = templates.findIndex((t) => t.id === id);
      if (idx >= 0) templates.splice(idx, 1);
    },
    async getEnvelopeSpend(grain) {
      // Mirror the server: net signed allocation flow per envelope per period, bucketed by the
      // transaction's date. Transfer legs carry no allocations and reallocations aren't allocations,
      // so both are excluded by construction. Archived envelopes are included.
      const periodOf = (d: string) => (grain === "year" ? d.slice(0, 4) : d.slice(0, 7));
      const netByEnvPeriod = new Map<string, Map<string, number>>();
      for (const t of txns) {
        const period = periodOf(t.occurredOn);
        for (const al of t.allocations) {
          const inner = netByEnvPeriod.get(al.envelopeId) ?? new Map<string, number>();
          inner.set(period, (inner.get(period) ?? 0) + al.amountCents);
          netByEnvPeriod.set(al.envelopeId, inner);
        }
      }
      const periods = [
        ...new Set([...netByEnvPeriod.values()].flatMap((m) => [...m.keys()])),
      ].sort();
      const rows = [...netByEnvPeriod.entries()]
        .map(([envelopeId, inner]) => {
          const env = envelopes.find((e) => e.id === envelopeId);
          const amounts = periods.map((p) => inner.get(p) ?? 0);
          return {
            envelopeId,
            envelopeName: env?.name ?? "?",
            archived: env ? env.archivedAt !== null : false,
            amounts,
            total: amounts.reduce((a, b) => a + b, 0),
          };
        })
        .sort((a, b) => a.envelopeName.localeCompare(b.envelopeName));
      const periodTotals = periods.map((_p, i) =>
        rows.reduce((s, r) => s + (r.amounts[i] ?? 0), 0),
      );
      const grandTotal = periodTotals.reduce((a, b) => a + b, 0);
      return { grain, periods, rows, periodTotals, grandTotal };
    },
    async getBudgetVsActual(month) {
      // Mirror the server: actual = net spend (outflow) = −Σ allocations on WITHDRAWAL txns that
      // month (funding deposits excluded; refund rows net it down). Reallocations aren't allocations.
      const netSpend = new Map<string, number>();
      for (const t of txns) {
        if (t.amountCents >= 0) continue; // outflow transactions only
        if (t.occurredOn.slice(0, 7) !== month) continue;
        for (const al of t.allocations) {
          netSpend.set(al.envelopeId, (netSpend.get(al.envelopeId) ?? 0) + al.amountCents);
        }
      }
      const rows = envelopes
        .filter((e) => e.archivedAt === null || targets.has(e.id) || netSpend.has(e.id))
        .map((e) => {
          const targetCents = targets.get(e.id) ?? null;
          const spentCents = -(netSpend.get(e.id) ?? 0);
          const remainingCents = targetCents === null ? null : targetCents - spentCents;
          return {
            envelopeId: e.id,
            envelopeName: e.name,
            archived: e.archivedAt !== null,
            targetCents,
            spentCents,
            remainingCents,
          };
        })
        .sort((a, b) => a.envelopeName.localeCompare(b.envelopeName));
      const totalTargetCents = rows.reduce((s, r) => s + (r.targetCents ?? 0), 0);
      const totalSpentCents = rows.reduce((s, r) => s + r.spentCents, 0);
      const totalRemainingCents = rows.reduce((s, r) => s + (r.remainingCents ?? 0), 0);
      return { month, rows, totalTargetCents, totalSpentCents, totalRemainingCents };
    },
    async setEnvelopeTarget(envelopeId, amount) {
      if (!envelopes.some((e) => e.id === envelopeId)) throw new ApiError("Envelope not found.");
      const cents = tryParseMoney(amount) ?? 0;
      if (cents <= 0) throw new ApiError("Enter a target greater than 0.");
      targets.set(envelopeId, cents);
      return { envelopeId, monthlyTargetCents: cents };
    },
    async clearEnvelopeTarget(envelopeId) {
      if (!envelopes.some((e) => e.id === envelopeId)) throw new ApiError("Envelope not found.");
      targets.delete(envelopeId);
    },
    ...overrides,
  };
  return api;
}
