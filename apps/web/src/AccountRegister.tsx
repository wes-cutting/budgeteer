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
import { ReconcilePanel } from "./ReconcilePanel";
import { InlineAllocationEditor } from "./InlineAllocationEditor";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Skeleton } from "./ui";
import styles from "./AccountRegister.module.css";

interface Props {
  api: Api;
  accountId: string;
  accountName: string;
  onBack: () => void;
  onOpenNeeds: () => void;
}

/** First/last day of the current calendar month as 'YYYY-MM-DD' — the register's default window (R8). */
function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const pad = (n: number): string => String(n).padStart(2, "0");
  const lastDay = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(lastDay)}` };
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [range, setRange] = useState(currentMonthRange);
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const [txns, envs, accounts, tpls] = await Promise.all([
        api.listTransactions(accountId, range),
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

  async function deleteRow(txn: TransactionView) {
    setDeletingId(txn.id);
    setError(null);
    try {
      if (txn.kind === "transfer" && txn.transferId) {
        await api.deleteTransfer(txn.transferId);
      } else {
        await api.deleteTransaction(txn.id);
      }
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete the transaction.");
    } finally {
      setDeletingId(null);
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
  }, [accountId, range.from, range.to]);

  // Client-side payee/memo search over the date-windowed rows (R8).
  const query = search.trim().toLowerCase();
  const visible =
    transactions === null
      ? null
      : query === ""
        ? transactions
        : transactions.filter(
            (t) =>
              (t.payee?.toLowerCase().includes(query) ?? false) ||
              (t.memo?.toLowerCase().includes(query) ?? false),
          );

  return (
    <main>
      <header className={styles.header}>
        <h1>{accountName}</h1>
        {balanceCents !== null ? (
          <p className={styles.balance}>Balance: {formatCents(balanceCents)}</p>
        ) : null}
        <span className={styles.spacer} />
        <Button variant="ghost" onClick={onBack}>
          ← Dashboard
        </Button>
        <Button variant="ghost" onClick={onOpenNeeds}>
          Needs allocation
        </Button>
      </header>

      {error ? <Alert>{error}</Alert> : null}

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

      <ReconcilePanel api={api} accountId={accountId} derivedBalanceCents={balanceCents ?? 0} />

      <section aria-labelledby="register-heading">
        <h2 id="register-heading">Transactions</h2>

        <Card>
          <form
            className={styles.filter}
            aria-label="Filter transactions"
            onSubmit={(e) => e.preventDefault()}
          >
            <Field label="From date" htmlFor="register-from">
              <Input
                id="register-from"
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </Field>
            <Field label="To date" htmlFor="register-to">
              <Input
                id="register-to"
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </Field>
            <Field label="Search payee or memo" htmlFor="register-search">
              <Input
                id="register-search"
                type="search"
                placeholder="Search payee or memo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </form>

          {transactions === null || visible === null ? (
            <Skeleton rows={4} />
          ) : transactions.length === 0 ? (
            <EmptyState title="No transactions yet">
              <p className={styles.muted}>Add your first one with the form above.</p>
            </EmptyState>
          ) : visible.length === 0 ? (
            <p className={styles.muted}>No transactions match your search.</p>
          ) : (
            <ul className={styles.list} aria-label="Transactions">
              {visible.map((t) =>
                t.kind === "transfer" ? (
                  <li key={t.id} className={styles.row}>
                    <span className={styles.date}>{t.occurredOn}</span>
                    <span className={styles.payee}>
                      {t.amountCents < 0 ? "Transfer to " : "Transfer from "}
                      {t.transferCounterpartName ?? "another account"}
                    </span>
                    <span
                      className={`${styles.amount} ${t.amountCents < 0 ? styles.neg : styles.pos}`}
                    >
                      {formatCents(t.amountCents)}
                    </span>
                    <span className={styles.actions}>
                      <Button
                        variant="danger"
                        disabled={deletingId === t.id}
                        onClick={() => void deleteRow(t)}
                        aria-label="Delete transfer"
                      >
                        {deletingId === t.id ? "Deleting…" : "Delete"}
                      </Button>
                    </span>
                  </li>
                ) : (
                  <li key={t.id} className={styles.row}>
                    <span className={styles.date}>{t.occurredOn}</span>
                    <span className={styles.payee}>
                      {t.payee ?? (t.kind === "opening" ? "Opening balance" : "—")}
                    </span>
                    <Badge tone={t.unallocatedCents === 0 ? "success" : "danger"}>
                      {t.unallocatedCents === 0
                        ? "fully allocated"
                        : `needs ${formatCents(Math.abs(t.unallocatedCents))}`}
                    </Badge>
                    <span
                      className={`${styles.amount} ${t.amountCents < 0 ? styles.neg : styles.pos}`}
                    >
                      {formatCents(t.amountCents)}
                    </span>
                    <span className={styles.actions}>
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
                      <Button
                        variant="danger"
                        disabled={deletingId === t.id}
                        onClick={() => void deleteRow(t)}
                        aria-label="Delete transaction"
                      >
                        {deletingId === t.id ? "Deleting…" : "Delete"}
                      </Button>
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </Card>
      </section>
    </main>
  );
}
