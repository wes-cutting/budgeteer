import { useState } from "react";
import { type AllocationDraft } from "./api";
import { centsToInput, formatCents, parseCents } from "./format";

interface EnvelopeOption {
  id: string;
  name: string;
}
interface Row {
  envelopeId: string;
  amount: string;
}

interface Props {
  /** The transaction's positive magnitude in cents (0 until an amount is entered). */
  magnitudeCents: number;
  envelopes: EnvelopeOption[];
  initial?: AllocationDraft[];
  submitting?: boolean;
  saveLabel?: string;
  onSave: (allocations: AllocationDraft[]) => void;
}

/**
 * The split-allocation editor (SPIKE-01). Single = the whole amount to one envelope; Split =
 * rows with a live Allocated/Remaining tally and a per-row "use remaining". Partial is allowed;
 * over-allocation disables Save. Reused for create and allocate-later.
 */
export function AllocationEditor({
  magnitudeCents,
  envelopes,
  initial,
  submitting = false,
  saveLabel = "Save",
  onSave,
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
  function useRemaining(index: number) {
    const current = parseCents(rows[index]?.amount ?? "") ?? 0;
    setRow(index, { amount: centsToInput(current + remainingCents) });
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
                value={row.envelopeId}
                onChange={(e) => setRow(i, { envelopeId: e.target.value })}
              >
                {envelopeOptions}
              </select>
              <input
                aria-label={`Amount for row ${i + 1}`}
                value={row.amount}
                onChange={(e) => setRow(i, { amount: e.target.value })}
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
          <button
            type="button"
            onClick={() => setRows((cur) => [...cur, { envelopeId: "", amount: "" }])}
          >
            Add row
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
