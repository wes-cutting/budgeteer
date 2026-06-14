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

interface Props {
  api: Api;
  onBack: () => void;
}

export function NeedsAllocation({ api, onBack }: Props) {
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
      <header>
        <h1>Needs allocation</h1>
        <button type="button" onClick={onBack}>
          ← Dashboard
        </button>
      </header>

      {error ? <p role="alert">{error}</p> : null}

      {items === null ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>Nothing to allocate — you&rsquo;re all caught up.</p>
      ) : (
        <ul aria-label="Needs allocation">
          {items.map((t) => (
            <li key={t.id}>
              <span>{t.accountName}</span>{" "}
              <span>{t.payee ?? (t.kind === "opening" ? "Opening balance" : "—")}</span>{" "}
              <span>{formatCents(t.amountCents)}</span>{" "}
              <span>needs {formatCents(Math.abs(t.unallocatedCents))}</span>
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
