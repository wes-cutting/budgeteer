import { useEffect, useState } from "react";
import {
  type AccountView,
  type AllocationDraft,
  type Api,
  type EnvelopeView,
  type TemplateView,
  type TransactionView,
} from "./api";
import { formatCents } from "./format";
import { AddTransactionForm } from "./AddTransactionForm";
import { TransferForm } from "./TransferForm";
import { InlineAllocationEditor } from "./InlineAllocationEditor";

interface Props {
  api: Api;
  accountId: string;
  accountName: string;
  onBack: () => void;
  onOpenNeeds: () => void;
}

export function AccountRegister({ api, accountId, accountName, onBack, onOpenNeeds }: Props) {
  const [transactions, setTransactions] = useState<TransactionView[] | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeView[]>([]);
  const [templates, setTemplates] = useState<TemplateView[]>([]);
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    try {
      const [txns, envs, accounts, tpls] = await Promise.all([
        api.listTransactions(accountId),
        api.listEnvelopes(),
        api.listAccounts(),
        api.listTemplates(),
      ]);
      setTransactions(txns);
      setEnvelopes(envs);
      setTemplates(tpls);
      setAccounts(accounts);
      setBalanceCents(accounts.find((a) => a.id === accountId)?.balanceCents ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't load this account.");
    }
  }

  async function saveAsTemplate(name: string, lines: AllocationDraft[]) {
    setError(null);
    try {
      await api.createTemplate({ name, lines });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save the template.");
    }
  }

  async function saveSplit(txn: TransactionView, allocations: AllocationDraft[]) {
    setSavingId(txn.id);
    setError(null);
    try {
      await api.setAllocations(txn.id, allocations);
      setEditingId(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save the split.");
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  return (
    <main>
      <header>
        <h1>{accountName}</h1>
        {balanceCents !== null ? <p>Balance: {formatCents(balanceCents)}</p> : null}
        <button type="button" onClick={onBack}>
          ← Dashboard
        </button>
        <button type="button" onClick={onOpenNeeds}>
          Needs allocation
        </button>
      </header>

      {error ? <p role="alert">{error}</p> : null}

      <AddTransactionForm
        api={api}
        accountId={accountId}
        envelopes={envelopes}
        templates={templates}
        onCreated={() => void load()}
        onSaveAsTemplate={(name, lines) => void saveAsTemplate(name, lines)}
      />

      <TransferForm
        api={api}
        fromAccount={
          accounts.find((a) => a.id === accountId) ?? {
            id: accountId,
            name: accountName,
            kind: "checking",
            balanceCents: balanceCents ?? 0,
            archivedAt: null,
          }
        }
        accounts={accounts}
        onTransferred={() => void load()}
      />

      <section aria-labelledby="register-heading">
        <h2 id="register-heading">Transactions</h2>
        {transactions === null ? (
          <p>Loading…</p>
        ) : transactions.length === 0 ? (
          <p>No transactions yet — add your first one.</p>
        ) : (
          <ul aria-label="Transactions">
            {transactions.map((t) =>
              t.kind === "transfer" ? (
                <li key={t.id}>
                  <span>{t.occurredOn}</span>{" "}
                  <span>
                    {t.amountCents < 0 ? "Transfer to " : "Transfer from "}
                    {t.transferCounterpartName ?? "another account"}
                  </span>{" "}
                  <span>{formatCents(t.amountCents)}</span>
                </li>
              ) : (
                <li key={t.id}>
                  <span>{t.occurredOn}</span>{" "}
                  <span>{t.payee ?? (t.kind === "opening" ? "Opening balance" : "—")}</span>{" "}
                  <span>{formatCents(t.amountCents)}</span>{" "}
                  <span>
                    {t.unallocatedCents === 0
                      ? "fully allocated"
                      : `needs ${formatCents(Math.abs(t.unallocatedCents))}`}
                  </span>
                  <InlineAllocationEditor
                    txn={t}
                    envelopes={envelopes}
                    templates={templates}
                    open={editingId === t.id}
                    submitting={savingId === t.id}
                    toggleLabel="Edit split"
                    saveLabel="Save split"
                    onToggle={() => setEditingId((cur) => (cur === t.id ? null : t.id))}
                    onSave={(allocs) => void saveSplit(t, allocs)}
                  />
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </main>
  );
}
