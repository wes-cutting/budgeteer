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
  onOpenEnvelope,
  onOpenNeeds,
  onOpenTemplates,
  onOpenRecurring,
  onOpenAnalysis,
  onOpenBudget,
  onOpenForecast,
  onOpenCredit,
  onOpenPayoff,
  onOpenNetWorth,
}: {
  api: Api;
  onOpenAccount?: (account: AccountView) => void;
  onOpenEnvelope?: (envelope: EnvelopeView) => void;
  onOpenNeeds?: () => void;
  onOpenTemplates?: () => void;
  onOpenRecurring?: () => void;
  onOpenAnalysis?: () => void;
  onOpenBudget?: () => void;
  onOpenForecast?: () => void;
  onOpenCredit?: () => void;
  onOpenPayoff?: () => void;
  onOpenNetWorth?: () => void;
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

  async function refreshAccounts() {
    try {
      setAccounts(await api.listAccounts());
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't refresh accounts.");
    }
  }
  async function renameAccount(id: string, name: string) {
    try {
      await api.renameAccount(id, name);
      await refreshAccounts();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't rename the account.");
    }
  }
  async function refreshEnvelopes() {
    try {
      setEnvelopes(await api.listEnvelopes());
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't refresh envelopes.");
    }
  }
  async function archiveAccount(id: string) {
    try {
      await api.archiveAccount(id);
      await refreshAccounts();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't archive the account.");
    }
  }
  async function unarchiveAccount(id: string) {
    try {
      await api.unarchiveAccount(id);
      await refreshAccounts();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't unarchive the account.");
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
        <button type="button" onClick={() => onOpenNetWorth?.()}>
          Net worth
        </button>
        <a href={exportUrl}>Download backup</a>
      </header>

      {loadError ? <p role="alert">{loadError}</p> : null}

      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">Accounts</h2>
        <AddAccountForm api={api} onCreated={(a) => setAccounts((cur) => [...(cur ?? []), a])} />
        <AccountList
          accounts={accounts}
          onOpen={onOpenAccount}
          onRename={(id, name) => void renameAccount(id, name)}
          onArchive={(id) => void archiveAccount(id)}
          onUnarchive={(id) => void unarchiveAccount(id)}
        />
      </section>

      <section aria-labelledby="envelopes-heading">
        <h2 id="envelopes-heading">Envelopes</h2>
        <AddEnvelopeForm api={api} onCreated={(e) => setEnvelopes((cur) => [...(cur ?? []), e])} />
        <EnvelopeList
          envelopes={envelopes}
          onOpen={onOpenEnvelope}
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
  onRename,
  onArchive,
  onUnarchive,
}: {
  accounts: AccountView[] | null;
  onOpen?: (account: AccountView) => void;
  onRename?: (id: string, name: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  if (accounts === null) return <p>Loading…</p>;
  const active = accounts.filter((a) => a.archivedAt === null);
  const archived = accounts.filter((a) => a.archivedAt !== null);
  if (active.length === 0 && archived.length === 0) {
    return <p>No accounts yet — add the bank, card, or cash accounts you use.</p>;
  }

  function renderRow(a: AccountView, isArchived: boolean) {
    return (
      <li key={a.id}>
        {renamingId === a.id ? (
          <span>
            <input
              aria-label={`Rename ${a.name}`}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                onRename?.(a.id, renameValue);
                setRenamingId(null);
              }}
            >
              Save
            </button>
          </span>
        ) : (
          <>
            {onOpen ? (
              <button type="button" onClick={() => onOpen(a)}>
                {a.name}
              </button>
            ) : (
              <span>{a.name}</span>
            )}{" "}
            <span>{a.kind}</span> <span>{formatCents(a.balanceCents)}</span>
            {!isArchived && onRename ? (
              <button
                type="button"
                aria-label={`Rename ${a.name}`}
                onClick={() => {
                  setRenamingId(a.id);
                  setRenameValue(a.name);
                }}
              >
                Rename
              </button>
            ) : null}
            {!isArchived && onArchive ? (
              <button
                type="button"
                aria-label={`Archive ${a.name}`}
                onClick={() => onArchive(a.id)}
              >
                Archive
              </button>
            ) : null}
            {isArchived && onUnarchive ? (
              <button
                type="button"
                aria-label={`Unarchive ${a.name}`}
                onClick={() => onUnarchive(a.id)}
              >
                Unarchive
              </button>
            ) : null}
          </>
        )}
      </li>
    );
  }

  return (
    <>
      <ul aria-label="Accounts list">{active.map((a) => renderRow(a, false))}</ul>
      {archived.length > 0 ? (
        <>
          <button type="button" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
          {showArchived ? (
            <section aria-labelledby="archived-accounts-heading">
              <h3 id="archived-accounts-heading">Archived accounts</h3>
              <ul aria-label="Archived accounts">{archived.map((a) => renderRow(a, true))}</ul>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function EnvelopeList({
  envelopes,
  onOpen,
  onArchive,
  onUnarchive,
}: {
  envelopes: EnvelopeView[] | null;
  onOpen?: (envelope: EnvelopeView) => void;
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
            {onOpen ? (
              <button type="button" onClick={() => onOpen(e)}>
                {e.name}
              </button>
            ) : (
              <span>{e.name}</span>
            )}{" "}
            <span>{e.kind}</span> <span>{formatCents(e.balanceCents)}</span>
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
                {onOpen ? (
                  <button type="button" onClick={() => onOpen(e)}>
                    {e.name}
                  </button>
                ) : (
                  <span>{e.name}</span>
                )}{" "}
                <span>{formatCents(e.balanceCents)}</span>
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
