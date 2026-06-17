import { type FormEvent, useEffect, useState } from "react";
import {
  type AccountKind,
  type AccountView,
  type Api,
  ApiError,
  type EnvelopeKind,
  type EnvelopeView,
  exportUrl,
} from "./api";
import { formatCents } from "./format";
import { MoveMoneyForm } from "./MoveMoneyForm";

const ACCOUNT_KINDS: AccountKind[] = ["checking", "savings", "credit", "loan", "cash", "other"];
const ENVELOPE_KINDS: EnvelopeKind[] = ["standard", "sinking_fund"];

export function Dashboard({
  api,
  onOpenAccount,
  onOpenNeeds,
  onOpenTemplates,
  onOpenRecurring,
  onOpenAnalysis,
  onOpenBudget,
  onOpenForecast,
  onOpenCredit,
  onOpenPayoff,
}: {
  api: Api;
  onOpenAccount?: (account: AccountView) => void;
  onOpenNeeds?: () => void;
  onOpenTemplates?: () => void;
  onOpenRecurring?: () => void;
  onOpenAnalysis?: () => void;
  onOpenBudget?: () => void;
  onOpenForecast?: () => void;
  onOpenCredit?: () => void;
  onOpenPayoff?: () => void;
}) {
  const [accounts, setAccounts] = useState<AccountView[] | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.listAccounts(), api.listEnvelopes()])
      .then(([a, e]) => {
        if (!active) return;
        setAccounts(a);
        setEnvelopes(e);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Couldn't load your data.");
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function refreshEnvelopes() {
    try {
      setEnvelopes(await api.listEnvelopes());
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't refresh envelopes.");
    }
  }
  async function archiveEnvelope(id: string) {
    try {
      await api.archiveEnvelope(id);
      await refreshEnvelopes();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't archive the envelope.");
    }
  }
  async function unarchiveEnvelope(id: string) {
    try {
      await api.unarchiveEnvelope(id);
      await refreshEnvelopes();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't unarchive the envelope.");
    }
  }

  return (
    <main>
      <header>
        <h1>Budgeteer</h1>
        <button type="button" onClick={() => onOpenNeeds?.()}>
          Needs allocation
        </button>
        <button type="button" onClick={() => onOpenTemplates?.()}>
          Templates
        </button>
        <button type="button" onClick={() => onOpenRecurring?.()}>
          Recurring
        </button>
        <button type="button" onClick={() => onOpenAnalysis?.()}>
          Analysis
        </button>
        <button type="button" onClick={() => onOpenBudget?.()}>
          Budget
        </button>
        <button type="button" onClick={() => onOpenForecast?.()}>
          Forecast
        </button>
        <button type="button" onClick={() => onOpenCredit?.()}>
          Credit
        </button>
        <button type="button" onClick={() => onOpenPayoff?.()}>
          Payoff
        </button>
        <a href={exportUrl}>Download backup</a>
      </header>

      {loadError ? <p role="alert">{loadError}</p> : null}

      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">Accounts</h2>
        <AddAccountForm api={api} onCreated={(a) => setAccounts((cur) => [...(cur ?? []), a])} />
        <AccountList accounts={accounts} onOpen={onOpenAccount} />
      </section>

      <section aria-labelledby="envelopes-heading">
        <h2 id="envelopes-heading">Envelopes</h2>
        <AddEnvelopeForm api={api} onCreated={(e) => setEnvelopes((cur) => [...(cur ?? []), e])} />
        <EnvelopeList
          envelopes={envelopes}
          onArchive={(id) => void archiveEnvelope(id)}
          onUnarchive={(id) => void unarchiveEnvelope(id)}
        />
        <MoveMoneyForm
          api={api}
          envelopes={envelopes ?? []}
          onMoved={() => void refreshEnvelopes()}
        />
      </section>
    </main>
  );
}

function AccountList({
  accounts,
  onOpen,
}: {
  accounts: AccountView[] | null;
  onOpen?: (account: AccountView) => void;
}) {
  if (accounts === null) return <p>Loading…</p>;
  if (accounts.length === 0) {
    return <p>No accounts yet — add the bank, card, or cash accounts you use.</p>;
  }
  return (
    <ul aria-label="Accounts list">
      {accounts.map((a) => (
        <li key={a.id}>
          {onOpen ? (
            <button type="button" onClick={() => onOpen(a)}>
              {a.name}
            </button>
          ) : (
            <span>{a.name}</span>
          )}{" "}
          <span>{a.kind}</span> <span>{formatCents(a.balanceCents)}</span>
        </li>
      ))}
    </ul>
  );
}

function EnvelopeList({
  envelopes,
  onArchive,
  onUnarchive,
}: {
  envelopes: EnvelopeView[] | null;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
}) {
  if (envelopes === null) return <p>Loading…</p>;
  const active = envelopes.filter((e) => e.archivedAt === null);
  const archived = envelopes.filter((e) => e.archivedAt !== null);
  if (active.length === 0 && archived.length === 0) {
    return <p>No envelopes yet — add your budget categories.</p>;
  }
  return (
    <>
      <ul aria-label="Envelopes list">
        {active.map((e) => (
          <li key={e.id}>
            <span>{e.name}</span> <span>{e.kind}</span> <span>{formatCents(e.balanceCents)}</span>
            {onArchive ? (
              <button type="button" onClick={() => onArchive(e.id)}>
                Archive
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {archived.length > 0 ? (
        <section aria-labelledby="archived-heading">
          <h3 id="archived-heading">Archived</h3>
          <ul aria-label="Archived envelopes">
            {archived.map((e) => (
              <li key={e.id}>
                <span>{e.name}</span> <span>{formatCents(e.balanceCents)}</span>
                {onUnarchive ? (
                  <button type="button" onClick={() => onUnarchive(e.id)}>
                    Unarchive
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function AddAccountForm({ api, onCreated }: { api: Api; onCreated: (a: AccountView) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("checking");
  const [startingBalance, setStartingBalance] = useState("0.00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const account = await api.createAccount({ name, kind, startingBalance });
      onCreated(account);
      setName("");
      setKind("checking");
      setStartingBalance("0.00");
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Couldn't save — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-label="Add account">
      <label>
        Name <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
          {ACCOUNT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label>
        Starting balance
        <input value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        Add account
      </button>
    </form>
  );
}

function AddEnvelopeForm({ api, onCreated }: { api: Api; onCreated: (e: EnvelopeView) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EnvelopeKind>("standard");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const envelope = await api.createEnvelope({ name, kind });
      onCreated(envelope);
      setName("");
      setKind("standard");
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Couldn't save — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-label="Add envelope">
      <label>
        Name <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value as EnvelopeKind)}>
          {ENVELOPE_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        Add envelope
      </button>
    </form>
  );
}
