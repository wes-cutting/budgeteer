import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { type AccountKind, type AccountView, type Api, ApiError } from "./api";
import { formatCents } from "./format";
import { Button, ConfirmDialog } from "./ui";

const ACCOUNT_KINDS: AccountKind[] = ["checking", "savings", "credit", "loan", "cash", "other"];

/**
 * UX6 — the `/accounts` LIST route (deferred from UX3, built now). The per-entity management
 * surface: a progressive "Add account" affordance, the account list with each name a `<Link>` to
 * its register (`/accounts/:id`, UX3 left these as buttons), and inline rename/archive/unarchive.
 * The household net-worth summary lives on `/manage` (it spans every account); this page owns the
 * accounts themselves. Loads on mount (the shell remounts routes on navigation, so figures refresh
 * on each visit — the established freshness model).
 */
export function AccountsList({ api }: { api: Api }) {
  const [accounts, setAccounts] = useState<AccountView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listAccounts()
      .then((a) => {
        if (active) setAccounts(a);
      })
      .catch((err: unknown) => {
        if (active)
          setLoadError(err instanceof Error ? err.message : "Couldn't load your accounts.");
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function refresh() {
    try {
      setAccounts(await api.listAccounts());
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't refresh accounts.");
    }
  }
  async function renameAccount(id: string, name: string) {
    try {
      await api.renameAccount(id, name);
      await refresh();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't rename the account.");
    }
  }
  async function archiveAccount(id: string) {
    try {
      await api.archiveAccount(id);
      await refresh();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't archive the account.");
    }
  }
  async function unarchiveAccount(id: string) {
    try {
      await api.unarchiveAccount(id);
      await refresh();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't unarchive the account.");
    }
  }

  return (
    <main>
      <h1>Accounts</h1>
      {loadError ? <p role="alert">{loadError}</p> : null}
      <AddAccountSection api={api} onCreated={(a) => setAccounts((cur) => [...(cur ?? []), a])} />
      <AccountList
        accounts={accounts}
        onRename={(id, name) => void renameAccount(id, name)}
        onArchive={(id) => void archiveAccount(id)}
        onUnarchive={(id) => void unarchiveAccount(id)}
      />
    </main>
  );
}

/**
 * Progressive "Add" affordance (UX6): the always-on Add form is now behind a button. Revealing it
 * swaps the button for the form + a Cancel, so there is never a second "Add account" control to make
 * the e2e/unit selectors ambiguous. Mount/unmount only — no opacity animation on a text wrapper
 * (that trips the axe contrast gate).
 */
function AddAccountSection({ api, onCreated }: { api: Api; onCreated: (a: AccountView) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="accent" onClick={() => setOpen(true)}>
        Add account
      </Button>
    );
  }
  return (
    <div>
      <AddAccountForm
        api={api}
        onCreated={(a) => {
          onCreated(a);
          setOpen(false);
        }}
      />
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

function AccountList({
  accounts,
  onRename,
  onArchive,
  onUnarchive,
}: {
  accounts: AccountView[] | null;
  onRename: (id: string, name: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  // UX12 — Archive is confirmed first (it hides the account from the active list). Capture the row
  // so the dialog can name it.
  const [pendingArchive, setPendingArchive] = useState<{ id: string; name: string } | null>(null);

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
                onRename(a.id, renameValue);
                setRenamingId(null);
              }}
            >
              Save
            </button>
          </span>
        ) : (
          <>
            {/* UX6 — the account name is now a <Link> to its register (UX3 left it a button). */}
            <Link to={`/accounts/${a.id}`}>{a.name}</Link> <span>{a.kind}</span>{" "}
            <span>{formatCents(a.balanceCents)}</span>
            {!isArchived ? (
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
            {!isArchived ? (
              <button
                type="button"
                aria-label={`Archive ${a.name}`}
                onClick={() => setPendingArchive({ id: a.id, name: a.name })}
              >
                Archive
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Unarchive ${a.name}`}
                onClick={() => onUnarchive(a.id)}
              >
                Unarchive
              </button>
            )}
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
              <h2 id="archived-accounts-heading">Archived accounts</h2>
              <ul aria-label="Archived accounts">{archived.map((a) => renderRow(a, true))}</ul>
            </section>
          ) : null}
        </>
      ) : null}
      <ConfirmDialog
        open={pendingArchive !== null}
        title="Archive account?"
        description={
          pendingArchive
            ? `“${pendingArchive.name}” moves to Archived and drops out of the active list. You can unarchive it later.`
            : undefined
        }
        confirmLabel="Archive"
        onConfirm={() => {
          if (pendingArchive) onArchive(pendingArchive.id);
          setPendingArchive(null);
        }}
        onCancel={() => setPendingArchive(null)}
      />
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
