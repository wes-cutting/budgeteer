import { type FormEvent, useEffect, useState } from "react";
import {
  type AllocationDraft,
  type Api,
  ApiError,
  type EnvelopeView,
  type TemplateView,
} from "./api";
import { formatMoney, tryParseMoney } from "@budgeteer/domain";
import { formatCents } from "./format";
import { ConfirmDialog, Skeleton, useToast } from "./ui";

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

  return (
    <main>
      <header>
        <h1>Templates</h1>
      </header>

      {error ? <p role="alert">{error}</p> : null}

      <form aria-label="New template" onSubmit={create}>
        <label>
          Name{" "}
          <input
            aria-label="Template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {lines.map((line, i) => (
          <div key={i}>
            <select
              aria-label={`Template envelope ${i + 1}`}
              value={line.envelopeId}
              onChange={(e) =>
                setLines((cur) =>
                  cur.map((l, idx) => (idx === i ? { ...l, envelopeId: e.target.value } : l)),
                )
              }
            >
              <option value="">Choose an envelope…</option>
              {envelopes
                .filter((env) => env.archivedAt === null)
                .map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
            </select>
            <input
              aria-label={`Template amount ${i + 1}`}
              value={line.amount}
              onChange={(e) =>
                setLines((cur) =>
                  cur.map((l, idx) => (idx === i ? { ...l, amount: e.target.value } : l)),
                )
              }
            />
            <button
              type="button"
              aria-label={`Remove line ${i + 1}`}
              onClick={() => setLines((cur) => cur.filter((_, idx) => idx !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((cur) => [...cur, { envelopeId: "", amount: "" }])}
        >
          + add line
        </button>
        <button type="submit">Save template</button>
      </form>

      <section aria-labelledby="templates-heading">
        <h2 id="templates-heading">Saved templates</h2>
        {templates === null ? (
          <Skeleton />
        ) : templates.length === 0 ? (
          <p>No templates yet — save a split to reuse it.</p>
        ) : (
          <ul aria-label="Templates">
            {templates.map((t) => (
              <li key={t.id}>
                {renamingId === t.id ? (
                  <span>
                    <input
                      aria-label={`Rename ${t.name}`}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                    />
                    <button type="button" onClick={() => void saveRename(t)}>
                      Save
                    </button>
                  </span>
                ) : (
                  <span>{t.name}</span>
                )}{" "}
                <span>
                  {t.lines.length} lines · {formatCents(totalCents(t))}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(t.id);
                    setRenameValue(t.name);
                  }}
                >
                  Rename
                </button>
                <button type="button" onClick={() => setPendingDelete(t)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
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
