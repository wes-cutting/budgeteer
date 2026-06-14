import { type KeyboardEvent, useState } from "react";
import { type AllocationDraft } from "./api";
import { centsToInput, formatCents, parseCents, splitEvenly } from "./format";

interface EnvelopeOption {
  id: string;
  name: string;
}
interface TemplateOption {
  id: string;
  name: string;
  lines: { envelopeId: string; amountCents: number }[];
}
interface Row {
  envelopeId: string;
  amount: string;
}

interface Props {
  /** The transaction's positive magnitude in cents (0 until an amount is entered). */
  magnitudeCents: number;
  envelopes: EnvelopeOption[];
  templates?: TemplateOption[];
  initial?: AllocationDraft[];
  submitting?: boolean;
  saveLabel?: string;
  onSave: (allocations: AllocationDraft[]) => void;
  onSaveAsTemplate?: (name: string, lines: AllocationDraft[]) => void;
}

/**
 * The split-allocation editor (SPIKE-01) + Slice 2 accelerators: apply a saved template
 * (pre-fills rows), distribute the remainder evenly, and keyboard-first row entry (Enter adds
 * the next row). Single = whole amount to one envelope; Split = rows with a live remainder.
 * Partial is allowed; over-allocation disables Save. Reused for create and allocate-later.
 */
export function AllocationEditor({
  magnitudeCents,
  envelopes,
  templates,
  initial,
  submitting = false,
  saveLabel = "Save",
  onSave,
  onSaveAsTemplate,
}: Props) {
  const [mode, setMode] = useState<"single" | "split">(
    initial && initial.length > 1 ? "split" : "single",
  );
  const [rows, setRows] = useState<Row[]>(
    initial && initial.length > 0
      ? initial.map((a) => ({ ...a }))
      : [{ envelopeId: "", amount: "" }],
  );
  const [singleEnvelopeId, setSingleEnvelopeId] = useState<string>(
    initial && initial.length === 1 ? (initial[0]?.envelopeId ?? "") : "",
  );
  const [autoFocusIndex, setAutoFocusIndex] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");

  function allocationsToSave(): AllocationDraft[] {
    if (mode === "single") {
      return singleEnvelopeId
        ? [{ envelopeId: singleEnvelopeId, amount: centsToInput(magnitudeCents) }]
        : [];
    }
    return rows
      .filter((r) => r.envelopeId !== "" && (parseCents(r.amount) ?? 0) > 0)
      .map((r) => ({ envelopeId: r.envelopeId, amount: r.amount }));
  }

  const allocatedCents = allocationsToSave().reduce(
    (sum, a) => sum + (parseCents(a.amount) ?? 0),
    0,
  );
  const remainingCents = magnitudeCents - allocatedCents;
  const over = remainingCents < 0;
  const anyInvalidAmount =
    mode === "split" && rows.some((r) => r.amount.trim() !== "" && parseCents(r.amount) === null);
  const canSave =
    !submitting &&
    magnitudeCents > 0 &&
    !over &&
    !anyInvalidAmount &&
    (mode === "single" ? singleEnvelopeId !== "" : true);

  function setRow(index: number, patch: Partial<Row>) {
    setRows((cur) => cur.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addRow(focus: boolean) {
    setRows((cur) => {
      if (focus) setAutoFocusIndex(cur.length);
      return [...cur, { envelopeId: "", amount: "" }];
    });
  }
  function useRemaining(index: number) {
    const current = parseCents(rows[index]?.amount ?? "") ?? 0;
    setRow(index, { amount: centsToInput(current + remainingCents) });
  }
  function onAmountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addRow(true);
    }
  }
  function distributeRemaining() {
    const eligible = rows.map((r, i) => i).filter((i) => rows[i]?.envelopeId !== "");
    if (eligible.length === 0) return;
    const parts = splitEvenly(remainingCents, eligible.length);
    setRows((cur) =>
      cur.map((r, i) => {
        const k = eligible.indexOf(i);
        if (k === -1) return r;
        const current = parseCents(r.amount) ?? 0;
        return { ...r, amount: centsToInput(current + (parts[k] ?? 0)) };
      }),
    );
  }
  function applyTemplate(templateId: string) {
    const tpl = templates?.find((t) => t.id === templateId);
    if (!tpl) return;
    setMode("split");
    setRows(
      tpl.lines.map((l) => ({ envelopeId: l.envelopeId, amount: centsToInput(l.amountCents) })),
    );
  }

  const envelopeOptions = (
    <>
      <option value="">Choose an envelope…</option>
      {envelopes.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </>
  );

  return (
    <fieldset>
      <legend>Allocate</legend>

      {(templates && templates.length > 0) || onSaveAsTemplate ? (
        <div>
          {templates && templates.length > 0 ? (
            <label>
              Apply template{" "}
              <select
                aria-label="Apply template"
                value=""
                onChange={(e) => {
                  if (e.target.value) applyTemplate(e.target.value);
                }}
              >
                <option value="">Apply template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {onSaveAsTemplate ? (
            <span>
              <input
                aria-label="New template name"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <button
                type="button"
                disabled={templateName.trim() === "" || allocationsToSave().length === 0}
                onClick={() => {
                  onSaveAsTemplate(templateName.trim(), allocationsToSave());
                  setTemplateName("");
                }}
              >
                Save as template
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      <div role="radiogroup" aria-label="Allocation mode">
        <label>
          <input
            type="radio"
            name="alloc-mode"
            checked={mode === "single"}
            onChange={() => setMode("single")}
          />{" "}
          Single
        </label>
        <label>
          <input
            type="radio"
            name="alloc-mode"
            checked={mode === "split"}
            onChange={() => setMode("split")}
          />{" "}
          Split
        </label>
      </div>

      {mode === "single" ? (
        <div>
          <label>
            Envelope{" "}
            <select
              aria-label="Envelope"
              value={singleEnvelopeId}
              onChange={(e) => setSingleEnvelopeId(e.target.value)}
            >
              {envelopeOptions}
            </select>
          </label>
          <span> Amount {formatCents(magnitudeCents)}</span>
        </div>
      ) : (
        <div>
          {rows.map((row, i) => (
            <div key={i}>
              <select
                aria-label={`Envelope for row ${i + 1}`}
                autoFocus={autoFocusIndex === i}
                value={row.envelopeId}
                onChange={(e) => setRow(i, { envelopeId: e.target.value })}
              >
                {envelopeOptions}
              </select>
              <input
                aria-label={`Amount for row ${i + 1}`}
                value={row.amount}
                onChange={(e) => setRow(i, { amount: e.target.value })}
                onKeyDown={onAmountKeyDown}
              />
              <button type="button" onClick={() => useRemaining(i)}>
                use remaining
              </button>
              <button
                type="button"
                aria-label={`Remove row ${i + 1}`}
                onClick={() => setRows((cur) => cur.filter((_, idx) => idx !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addRow(false)}>
            Add row
          </button>
          <button type="button" onClick={distributeRemaining}>
            distribute remaining
          </button>
        </div>
      )}

      <p>
        Allocated {formatCents(allocatedCents)} ·{" "}
        {over
          ? `Over-allocated by ${formatCents(-remainingCents)}`
          : `Remaining ${formatCents(remainingCents)}`}
      </p>
      <button type="button" disabled={!canSave} onClick={() => onSave(allocationsToSave())}>
        {saveLabel}
      </button>
    </fieldset>
  );
}
