import { type KeyboardEvent, useState } from "react";
import { type AllocationDraft } from "./api";
import { formatMoney, splitEvenly, tryParseMoney } from "@budgeteer/domain";
import { formatCents } from "./format";

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
  /** A refund row points OPPOSITE the transaction direction (FEAT-008): it gives money back. */
  refund: boolean;
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
    initial && (initial.length > 1 || initial.some((a) => a.refund)) ? "split" : "single",
  );
  const [rows, setRows] = useState<Row[]>(
    initial && initial.length > 0
      ? initial.map((a) => ({
          envelopeId: a.envelopeId,
          amount: a.amount,
          refund: a.refund ?? false,
        }))
      : [{ envelopeId: "", amount: "", refund: false }],
  );
  const [singleEnvelopeId, setSingleEnvelopeId] = useState<string>(
    initial && initial.length === 1 ? (initial[0]?.envelopeId ?? "") : "",
  );
  const [autoFocusIndex, setAutoFocusIndex] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");

  function allocationsToSave(): AllocationDraft[] {
    if (mode === "single") {
      return singleEnvelopeId
        ? [{ envelopeId: singleEnvelopeId, amount: formatMoney(magnitudeCents) }]
        : [];
    }
    return rows
      .filter((r) => r.envelopeId !== "" && (tryParseMoney(r.amount) ?? 0) > 0)
      .map((r) =>
        // `refund` is an exception flag — include it only when set (normal rows stay {envelopeId, amount}).
        r.refund
          ? { envelopeId: r.envelopeId, amount: r.amount, refund: true }
          : { envelopeId: r.envelopeId, amount: r.amount },
      );
  }

  // Net toward the amount: a normal row adds its magnitude, a refund row subtracts it (FEAT-008).
  const netCents = allocationsToSave().reduce(
    (sum, a) => sum + (tryParseMoney(a.amount) ?? 0) * (a.refund ? -1 : 1),
    0,
  );
  const remainingCents = magnitudeCents - netCents;
  const over = remainingCents < 0; // net exceeds the amount
  const under = netCents < 0; // refunds exceed spend → would flip direction
  const anyInvalidAmount =
    mode === "split" &&
    rows.some((r) => r.amount.trim() !== "" && tryParseMoney(r.amount) === null);
  const canSave =
    !submitting &&
    magnitudeCents > 0 &&
    !over &&
    !under &&
    !anyInvalidAmount &&
    (mode === "single" ? singleEnvelopeId !== "" : true);

  function setRow(index: number, patch: Partial<Row>) {
    setRows((cur) => cur.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addRow(focus: boolean) {
    setRows((cur) => {
      if (focus) setAutoFocusIndex(cur.length);
      return [...cur, { envelopeId: "", amount: "", refund: false }];
    });
  }
  function useRemaining(index: number) {
    const current = tryParseMoney(rows[index]?.amount ?? "") ?? 0;
    setRow(index, { amount: formatMoney(current + remainingCents) });
  }
  function onAmountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addRow(true);
    }
  }
  function distributeRemaining() {
    // Spread the remainder across normal (non-refund) rows only.
    const eligible = rows
      .map((r, i) => i)
      .filter((i) => rows[i]?.envelopeId !== "" && !rows[i]?.refund);
    if (eligible.length === 0) return;
    const parts = splitEvenly(remainingCents, eligible.length);
    setRows((cur) =>
      cur.map((r, i) => {
        const k = eligible.indexOf(i);
        if (k === -1) return r;
        const current = tryParseMoney(r.amount) ?? 0;
        return { ...r, amount: formatMoney(current + (parts[k] ?? 0)) };
      }),
    );
  }
  function applyTemplate(templateId: string) {
    const tpl = templates?.find((t) => t.id === templateId);
    if (!tpl) return;
    setMode("split");
    setRows(
      tpl.lines.map((l) => ({
        envelopeId: l.envelopeId,
        amount: formatMoney(l.amountCents),
        refund: false,
      })),
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
              <label>
                <input
                  type="checkbox"
                  aria-label={`Refund for row ${i + 1}`}
                  checked={row.refund}
                  onChange={(e) => setRow(i, { refund: e.target.checked })}
                />{" "}
                Refund
              </label>
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
        Allocated {formatCents(netCents)} ·{" "}
        {over
          ? `Over-allocated by ${formatCents(-remainingCents)}`
          : under
            ? `Refunds exceed the amount by ${formatCents(-netCents)}`
            : `Remaining ${formatCents(remainingCents)}`}
      </p>
      <button type="button" disabled={!canSave} onClick={() => onSave(allocationsToSave())}>
        {saveLabel}
      </button>
    </fieldset>
  );
}
