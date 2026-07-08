import { useEffect, useState } from "react";
import {
  type AllocationDraft,
  type Api,
  type EnvelopeView,
  type TemplateView,
  type TransactionView,
} from "./api";
import { formatCents } from "./format";
import { InlineAllocationEditor } from "./InlineAllocationEditor";
import { Skeleton } from "./ui";
import styles from "./Ledgers.module.css";

interface Props {
  api: Api;
}

export function NeedsAllocation({ api }: Props) {
  const [items, setItems] = useState<TransactionView[] | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeView[]>([]);
  const [templates, setTemplates] = useState<TemplateView[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [needs, envs, tpls] = await Promise.all([
        api.listNeedsAllocation(),
        api.listEnvelopes(),
        api.listTemplates(),
      ]);
      setItems(needs);
      setEnvelopes(envs);
      setTemplates(tpls);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't load.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAllocations(txn: TransactionView, allocations: AllocationDraft[]) {
    setSubmittingId(txn.id);
    setError(null);
    try {
      await api.setAllocations(txn.id, allocations);
      setOpenId(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <main>
      {/* FEAT-UXR1 — the page title is the shell's single <h1> (top bar); this view drops its own. */}
      {error ? <p role="alert">{error}</p> : null}

      {items === null ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <p>Nothing to allocate — you&rsquo;re all caught up.</p>
      ) : (
        // UXR3 — the waiting-transactions list as a table (Date · Payee/memo · Account · Amount),
        // the Allocate editor carried per row in the actions cell. The "needs $X" remainder the list
        // showed rides under the amount (styles.subNote). Column headers only — a waiting txn has no
        // single stable row-identifier to promote to a <th scope="row">.
        <div className="table-scroll" tabIndex={0} role="group" aria-label="Needs allocation">
          <table className={styles.table}>
            <caption className="sr-only">Needs allocation</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Payee/memo</th>
                <th scope="col">Account</th>
                <th scope="col" className={styles.numeric}>
                  Amount
                </th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>{t.occurredOn}</td>
                  <td>{t.payee ?? (t.kind === "opening" ? "Opening balance" : "—")}</td>
                  <td>{t.accountName}</td>
                  <td className={styles.numeric}>
                    {formatCents(t.amountCents)}
                    <span className={styles.subNote}>
                      needs {formatCents(Math.abs(t.unallocatedCents))}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <InlineAllocationEditor
                        txn={t}
                        envelopes={envelopes}
                        templates={templates}
                        open={openId === t.id}
                        submitting={submittingId === t.id}
                        toggleLabel="Allocate"
                        saveLabel="Save allocation"
                        onToggle={() => setOpenId((cur) => (cur === t.id ? null : t.id))}
                        onSave={(allocs) => void saveAllocations(t, allocs)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
