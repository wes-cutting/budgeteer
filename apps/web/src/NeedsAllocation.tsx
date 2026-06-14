import { useEffect, useState } from "react";
import {
  type AllocationDraft,
  type Api,
  type EnvelopeView,
  type TemplateView,
  type TransactionView,
} from "./api";
import { centsToInput, formatCents } from "./format";
import { AllocationEditor } from "./AllocationEditor";

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
              <button
                type="button"
                onClick={() => setOpenId((cur) => (cur === t.id ? null : t.id))}
              >
                Allocate
              </button>
              {openId === t.id ? (
                <AllocationEditor
                  magnitudeCents={Math.abs(t.amountCents)}
                  envelopes={envelopes.map((e) => ({ id: e.id, name: e.name }))}
                  templates={templates}
                  initial={t.allocations.map((a) => ({
                    envelopeId: a.envelopeId,
                    amount: centsToInput(Math.abs(a.amountCents)),
                  }))}
                  submitting={submittingId === t.id}
                  saveLabel="Save allocation"
                  onSave={(allocs) => void saveAllocations(t, allocs)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
