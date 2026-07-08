import { type FormEvent, useEffect, useId, useState } from "react";
import {
  type AllocationDraft,
  type Api,
  ApiError,
  type EnvelopeView,
  type TemplateView,
} from "./api";
import { formatMoney, tryParseMoney } from "@budgeteer/domain";
import { formatCents } from "./format";
import { Button, ConfirmDialog, Field, Input, Select, Skeleton, useToast } from "./ui";
import ledger from "./Ledgers.module.css";
import form from "./FormLayout.module.css";

interface Props {
  api: Api;
}
interface LineDraft {
  envelopeId: string;
  amount: string;
}

export function TemplatesView({ api }: Props) {
  const [templates, setTemplates] = useState<TemplateView[] | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeView[]>([]);
  const [name, setName] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ envelopeId: "", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // UX12 — Delete is irreversible (no unarchive for templates), so confirm before removing.
  const [pendingDelete, setPendingDelete] = useState<TemplateView | null>(null);
  const { showToast } = useToast();
  const nameId = useId();

  async function load() {
    try {
      const [tpls, envs] = await Promise.all([api.listTemplates(), api.listEnvelopes()]);
      setTemplates(tpls);
      setEnvelopes(envs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't load templates.");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCents = (t: TemplateView) => t.lines.reduce((s, l) => s + l.amountCents, 0);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const drafts: AllocationDraft[] = lines
      .filter((l) => l.envelopeId !== "" && (tryParseMoney(l.amount) ?? 0) > 0)
      .map((l) => ({ envelopeId: l.envelopeId, amount: l.amount }));
    try {
      await api.createTemplate({ name, lines: drafts });
      setName("");
      setLines([{ envelopeId: "", amount: "" }]);
      await load();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Couldn't save — try again.");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.deleteTemplate(id);
      await load();
      showToast("Template deleted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
    }
  }

  async function saveRename(template: TemplateView) {
    setError(null);
    try {
      await api.updateTemplate(template.id, {
        name: renameValue,
        lines: template.lines.map((l) => ({
          envelopeId: l.envelopeId,
          amount: formatMoney(l.amountCents),
        })),
      });
      setRenamingId(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Couldn't rename.");
    }
  }

  const activeEnvelopes = envelopes.filter((env) => env.archivedAt === null);

  return (
    <main>
      {/* FEAT-UXR1 — the page title is the shell's single <h1> (top bar); this view drops its own. */}

      {/* FEAT-UXR4 — the template editor, on the §3 form-layout pattern: a grouped fieldset, the
          Name field via the UX4 `Field` primitive, the envelope/amount rows as a labeled mini-grid,
          "+ Add line" beneath, and a right-aligned action row. Behavior is unchanged from before
          (blank/zero lines filtered on save; form resets after create). */}
      <form aria-label="New template" onSubmit={create} className={form.form}>
        <fieldset className={form.fieldset}>
          <legend className={form.legend}>New template</legend>
          <Field label="Name" htmlFor={nameId}>
            <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <div className={form.lineGrid}>
            <div className={form.lineHeader} aria-hidden="true">
              <span>Envelope</span>
              <span className={form.amount}>Amount</span>
              <span />
            </div>
            {lines.map((line, i) => (
              <div key={i} className={form.lineRow}>
                <Select
                  aria-label={`Template envelope ${i + 1}`}
                  value={line.envelopeId}
                  onChange={(e) =>
                    setLines((cur) =>
                      cur.map((l, idx) => (idx === i ? { ...l, envelopeId: e.target.value } : l)),
                    )
                  }
                >
                  <option value="">Choose an envelope…</option>
                  {activeEnvelopes.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label={`Template amount ${i + 1}`}
                  className={form.amount}
                  inputMode="decimal"
                  value={line.amount}
                  onChange={(e) =>
                    setLines((cur) =>
                      cur.map((l, idx) => (idx === i ? { ...l, amount: e.target.value } : l)),
                    )
                  }
                />
                <Button
                  className={form.removeLine}
                  variant="ghost"
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => setLines((cur) => cur.filter((_, idx) => idx !== i))}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
          <Button
            className={form.addLine}
            variant="ghost"
            onClick={() => setLines((cur) => [...cur, { envelopeId: "", amount: "" }])}
          >
            + Add line
          </Button>

          {error ? <p role="alert">{error}</p> : null}
          <div className={form.actionRow}>
            <Button type="submit" variant="accent">
              Save template
            </Button>
          </div>
        </fieldset>
      </form>

      <section aria-labelledby="templates-heading">
        <h2 id="templates-heading">Saved templates</h2>
        {templates === null ? (
          <Skeleton />
        ) : templates.length === 0 ? (
          <p>No templates yet — save a split to reuse it.</p>
        ) : (
          // FEAT-UXR4 — the saved-templates list becomes a real table on the shared UXR3
          // treatment (Ledgers.module.css, reused verbatim). Name is the row header; Lines/Total
          // are right-aligned numeric columns; the carried Rename (inline) + Delete (ConfirmDialog)
          // sit in the Actions cell with per-row accessible names.
          <div className="table-scroll" tabIndex={0} role="group" aria-label="Templates">
            <table className={ledger.table}>
              <caption className="sr-only">Templates</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className={ledger.numeric}>
                    Lines
                  </th>
                  <th scope="col" className={ledger.numeric}>
                    Total
                  </th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    {renamingId === t.id ? (
                      <th scope="row" className={ledger.actions}>
                        <input
                          aria-label={`Rename ${t.name}`}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                        />
                        <button type="button" onClick={() => void saveRename(t)}>
                          Save
                        </button>
                      </th>
                    ) : (
                      <th scope="row">{t.name}</th>
                    )}
                    <td className={ledger.numeric}>{t.lines.length}</td>
                    <td className={ledger.numeric}>{formatCents(totalCents(t))}</td>
                    <td>
                      <div className={ledger.actions}>
                        <button
                          type="button"
                          aria-label={`Rename ${t.name}`}
                          onClick={() => {
                            setRenamingId(t.id);
                            setRenameValue(t.name);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${t.name}`}
                          onClick={() => setPendingDelete(t)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete template?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” will be permanently deleted. This can’t be undone.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
