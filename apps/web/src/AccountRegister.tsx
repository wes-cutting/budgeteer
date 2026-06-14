import { useEffect, useState } from "react";
import {
  type AllocationDraft,
  type Api,
  type EnvelopeView,
  type TemplateView,
  type TransactionView,
} from "./api";
import { formatCents } from "./format";
import { AddTransactionForm } from "./AddTransactionForm";

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
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      <section aria-labelledby="register-heading">
        <h2 id="register-heading">Transactions</h2>
        {transactions === null ? (
          <p>Loading…</p>
        ) : transactions.length === 0 ? (
          <p>No transactions yet — add your first one.</p>
        ) : (
          <ul aria-label="Transactions">
            {transactions.map((t) => (
              <li key={t.id}>
                <span>{t.occurredOn}</span>{" "}
                <span>{t.payee ?? (t.kind === "opening" ? "Opening balance" : "—")}</span>{" "}
                <span>{formatCents(t.amountCents)}</span>{" "}
                <span>
                  {t.unallocatedCents === 0
                    ? "fully allocated"
                    : `needs ${formatCents(Math.abs(t.unallocatedCents))}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
