import { type FormEvent, useId, useState } from "react";
import { type Api, ApiError, type EnvelopeView } from "./api";
import { Field, FieldError, Input, Select } from "./ui";
import { amountFieldError } from "./validation";
import form from "./FormLayout.module.css";

/** Re-budget money between two envelopes (no account movement, FEAT-007 #7b / ADR-0004 B). */
export function MoveMoneyForm({
  api,
  envelopes,
  onMoved,
}: {
  api: Api;
  envelopes: EnvelopeView[];
  onMoved: () => void;
}) {
  const active = envelopes.filter((e) => e.archivedAt === null);
  const [fromEnvelopeId, setFromEnvelopeId] = useState("");
  const [toEnvelopeId, setToEnvelopeId] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [memo, setMemo] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fid = useId();
  const amountErrorId = useId();
  // Inline (UX12d): un-parseable amount surfaces as a field-level error on blur, live thereafter.
  const amountError = amountTouched ? amountFieldError(amount) : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!fromEnvelopeId || !toEnvelopeId) {
      setError("Choose both envelopes.");
      return;
    }
    if (fromEnvelopeId === toEnvelopeId) {
      setError("Choose two different envelopes.");
      return;
    }
    if (amountFieldError(amount)) {
      setAmountTouched(true);
      return; // don't round-trip an amount we already know won't parse
    }
    setSubmitting(true);
    try {
      await api.createEnvelopeTransfer({
        fromEnvelopeId,
        toEnvelopeId,
        amount,
        memo: memo.trim() === "" ? undefined : memo.trim(),
      });
      setFromEnvelopeId("");
      setToEnvelopeId("");
      setAmount("0.00");
      setMemo("");
      onMoved();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Couldn't move money — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Need at least two active envelopes to move budgeted money between.
  if (active.length < 2) return null;

  return (
    // FEAT-UXR7 — the Move-money form on the UXR4 form-layout pattern (import of FormLayout.module.css,
    // the same reuse UXR5 proved): a grouped fieldset with a visible legend, every control via the UX4
    // `Field`/`Input`/`Select` primitives, natural pairs gridded (From+To, Amount+Memo) and stacking
    // ≤ 640px, and a right-aligned action row. Behavior is byte-for-byte the same — the UX12d inline
    // amount validation, the both/different-envelope guards, reset-on-success, and the envelope-transfer
    // API call are unchanged; only the framing adopts the pattern.
    <form className={form.form} onSubmit={onSubmit} aria-label="Move money between envelopes">
      <fieldset className={form.fieldset}>
        <legend className={form.legend}>Move money</legend>
        <div className={form.fieldRow}>
          <Field label="From envelope" htmlFor={`${fid}-from`}>
            <Select
              id={`${fid}-from`}
              value={fromEnvelopeId}
              onChange={(e) => setFromEnvelopeId(e.target.value)}
            >
              <option value="">Select…</option>
              {active.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To envelope" htmlFor={`${fid}-to`}>
            <Select
              id={`${fid}-to`}
              value={toEnvelopeId}
              onChange={(e) => setToEnvelopeId(e.target.value)}
            >
              <option value="">Select…</option>
              {active.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className={form.fieldRow}>
          <Field label="Amount" htmlFor={`${fid}-amount`}>
            <Input
              id={`${fid}-amount`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setAmountTouched(true)}
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountError ? amountErrorId : undefined}
            />
            {amountError ? <FieldError id={amountErrorId}>{amountError}</FieldError> : null}
          </Field>
          <Field label="Memo" htmlFor={`${fid}-memo`}>
            <Input id={`${fid}-memo`} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </Field>
        </div>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
      <div className={form.actionRow}>
        <button type="submit" disabled={submitting}>
          Move money
        </button>
      </div>
    </form>
  );
}
