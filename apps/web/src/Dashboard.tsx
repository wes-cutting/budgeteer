import { type FormEvent, useEffect, useState } from "react";
import {
  type AccountKind,
  type AccountView,
  type Api,
  ApiError,
  type EnvelopeKind,
  type EnvelopeView,
} from "./api";
import { formatCents } from "./format";

const ACCOUNT_KINDS: AccountKind[] = ["checking", "savings", "credit", "cash", "other"];
const ENVELOPE_KINDS: EnvelopeKind[] = ["standard", "sinking_fund"];

export function Dashboard({ api }: { api: Api }) {
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

  return (
    <main>
      <header>
        <h1>Budgeteer</h1>
        <p>Needs allocation: {formatCents(0)}</p>
      </header>

      {loadError ? <p role="alert">{loadError}</p> : null}

      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">Accounts</h2>
        <AddAccountForm api={api} onCreated={(a) => setAccounts((cur) => [...(cur ?? []), a])} />
        <AccountList accounts={accounts} />
      </section>

      <section aria-labelledby="envelopes-heading">
        <h2 id="envelopes-heading">Envelopes</h2>
        <AddEnvelopeForm api={api} onCreated={(e) => setEnvelopes((cur) => [...(cur ?? []), e])} />
        <EnvelopeList envelopes={envelopes} />
      </section>
    </main>
  );
}

function AccountList({ accounts }: { accounts: AccountView[] | null }) {
  if (accounts === null) return <p>Loading…</p>;
  if (accounts.length === 0) {
    return <p>No accounts yet — add the bank, card, or cash accounts you use.</p>;
  }
  return (
    <ul aria-label="Accounts list">
      {accounts.map((a) => (
        <li key={a.id}>
          <span>{a.name}</span> <span>{a.kind}</span> <span>{formatCents(a.balanceCents)}</span>
        </li>
      ))}
    </ul>
  );
}

function EnvelopeList({ envelopes }: { envelopes: EnvelopeView[] | null }) {
  if (envelopes === null) return <p>Loading…</p>;
  if (envelopes.length === 0) {
    return <p>No envelopes yet — add your budget categories.</p>;
  }
  return (
    <ul aria-label="Envelopes list">
      {envelopes.map((e) => (
        <li key={e.id}>
          <span>{e.name}</span> <span>{e.kind}</span> <span>{formatCents(e.balanceCents)}</span>
        </li>
      ))}
    </ul>
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
