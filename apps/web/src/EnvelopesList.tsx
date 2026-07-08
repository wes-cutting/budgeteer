import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  type Api,
  ApiError,
  type BudgetVsActualRow,
  type EnvelopeKind,
  type EnvelopeView,
} from "./api";
import { localMonth as currentMonth } from "./dates";
import { formatCents } from "./format";
import { Button, ConfirmDialog, Skeleton, useToast } from "./ui";
import styles from "./Ledgers.module.css";

const ENVELOPE_KINDS: EnvelopeKind[] = ["standard", "sinking_fund"];
// R5 — current calendar month ("YYYY-MM") for the inline envelope-target join (the budget endpoint
// keys targets/spend by month).

/**
 * UX6 — the `/envelopes` LIST route (deferred from UX3, built now). The per-entity management
 * surface: a progressive "Add envelope" affordance, the envelope list with each name a `<Link>` to
 * its ledger (`/envelopes/:id`, UX3 left these as buttons), inline archive/unarchive, and the R5
 * inline monthly target/spent/remaining. Move-money lives on `/manage` (it spans two envelopes);
 * this page owns the envelopes themselves.
 */
export function EnvelopesList({ api }: { api: Api }) {
  const [envelopes, setEnvelopes] = useState<EnvelopeView[] | null>(null);
  const [budgetByEnvelope, setBudgetByEnvelope] = useState<Map<string, BudgetVsActualRow> | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    api
      .listEnvelopes()
      .then((e) => {
        if (active) setEnvelopes(e);
      })
      .catch((err: unknown) => {
        if (active)
          setLoadError(err instanceof Error ? err.message : "Couldn't load your envelopes.");
      });
    // R5 — inline envelope targets, fetched independently: a failure here leaves each row's
    // target/spent/remaining absent rather than blanking the page.
    api
      .getBudgetVsActual(currentMonth())
      .then((report) => {
        if (active) setBudgetByEnvelope(new Map(report.rows.map((r) => [r.envelopeId, r])));
      })
      .catch(() => {
        /* inline targets are auxiliary — leave them absent on error */
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function refresh() {
    try {
      setEnvelopes(await api.listEnvelopes());
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't refresh envelopes.");
    }
  }
  async function archiveEnvelope(id: string) {
    try {
      await api.archiveEnvelope(id);
      await refresh();
      showToast("Envelope archived");
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't archive the envelope.");
    }
  }
  async function unarchiveEnvelope(id: string) {
    try {
      await api.unarchiveEnvelope(id);
      await refresh();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't unarchive the envelope.");
    }
  }

  return (
    <main>
      {/* FEAT-UXR1 — the page title is the shell's single <h1> (top bar); this view drops its own. */}
      {loadError ? <p role="alert">{loadError}</p> : null}
      <AddEnvelopeSection
        api={api}
        onCreated={(e) => {
          setEnvelopes((cur) => [...(cur ?? []), e]);
          showToast("Envelope created");
        }}
      />
      <EnvelopeList
        envelopes={envelopes}
        budgetByEnvelope={budgetByEnvelope}
        onArchive={(id) => void archiveEnvelope(id)}
        onUnarchive={(id) => void unarchiveEnvelope(id)}
      />
    </main>
  );
}

/** Progressive "Add" affordance (UX6) — see AccountsList for the swap rationale. */
function AddEnvelopeSection({
  api,
  onCreated,
}: {
  api: Api;
  onCreated: (e: EnvelopeView) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="accent" onClick={() => setOpen(true)}>
        Add envelope
      </Button>
    );
  }
  return (
    <div>
      <AddEnvelopeForm
        api={api}
        onCreated={(e) => {
          onCreated(e);
          setOpen(false);
        }}
      />
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

/**
 * R5 — inline envelope target as three table cells: an active envelope's monthly target, spend, and
 * remaining (target − spent). The figures render ONLY when a target is set — an untargeted envelope
 * shows "—" in all three (no faked $0, the R5 rule). Plain numeric text (not colour-coded);
 * `remaining` keeps its sign (negative = over budget).
 */
function EnvelopeBudgetCells({ row }: { row: BudgetVsActualRow | null }) {
  if (row === null || row.targetCents === null) {
    return (
      <>
        <td className={styles.numeric}>—</td>
        <td className={styles.numeric}>—</td>
        <td className={styles.numeric}>—</td>
      </>
    );
  }
  return (
    <>
      <td className={styles.numeric}>{formatCents(row.targetCents)}</td>
      <td className={styles.numeric}>{formatCents(row.spentCents)}</td>
      <td className={styles.numeric}>
        {row.remainingCents === null ? "—" : formatCents(row.remainingCents)}
      </td>
    </>
  );
}

function EnvelopeList({
  envelopes,
  budgetByEnvelope,
  onArchive,
  onUnarchive,
}: {
  envelopes: EnvelopeView[] | null;
  budgetByEnvelope: Map<string, BudgetVsActualRow> | null;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
}) {
  // UX12 — Archive is confirmed before it runs (it moves the envelope out of the active list and
  // out of this month's budget). The pending row is captured so the dialog can name it.
  const [pendingArchive, setPendingArchive] = useState<{ id: string; name: string } | null>(null);
  if (envelopes === null) return <Skeleton />;
  const active = envelopes.filter((e) => e.archivedAt === null);
  const archived = envelopes.filter((e) => e.archivedAt !== null);
  if (active.length === 0 && archived.length === 0) {
    return <p>No envelopes yet — add your budget categories.</p>;
  }
  return (
    <>
      <div className="table-scroll" tabIndex={0} role="group" aria-label="Envelopes">
        <table className={styles.table}>
          <caption className="sr-only">Envelopes</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Kind</th>
              <th scope="col" className={styles.numeric}>
                Balance
              </th>
              <th scope="col" className={styles.numeric}>
                Target
              </th>
              <th scope="col" className={styles.numeric}>
                Spent
              </th>
              <th scope="col" className={styles.numeric}>
                Remaining
              </th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {active.map((e) => (
              <tr key={e.id}>
                <th scope="row">
                  {/* UX6 — the envelope name is a <Link> to its ledger (UX3 left it a button). */}
                  <Link to={`/envelopes/${e.id}`}>{e.name}</Link>
                </th>
                <td>{e.kind}</td>
                <td className={styles.numeric}>{formatCents(e.balanceCents)}</td>
                <EnvelopeBudgetCells row={budgetByEnvelope?.get(e.id) ?? null} />
                <td>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      aria-label={`Archive ${e.name}`}
                      onClick={() => setPendingArchive({ id: e.id, name: e.name })}
                    >
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {archived.length > 0 ? (
        <section aria-labelledby="archived-envelopes-heading">
          <h2 id="archived-envelopes-heading">Archived</h2>
          <div
            className="table-scroll"
            tabIndex={0}
            role="group"
            aria-labelledby="archived-envelopes-heading"
          >
            <table className={styles.table}>
              <caption className="sr-only">Archived envelopes</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className={styles.numeric}>
                    Balance
                  </th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archived.map((e) => (
                  <tr key={e.id}>
                    <th scope="row">
                      <Link to={`/envelopes/${e.id}`}>{e.name}</Link>
                    </th>
                    <td className={styles.numeric}>{formatCents(e.balanceCents)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          aria-label={`Unarchive ${e.name}`}
                          onClick={() => onUnarchive(e.id)}
                        >
                          Unarchive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <ConfirmDialog
        open={pendingArchive !== null}
        title="Archive envelope?"
        description={
          pendingArchive
            ? `“${pendingArchive.name}” moves to Archived and leaves this month’s budget. You can unarchive it later.`
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
