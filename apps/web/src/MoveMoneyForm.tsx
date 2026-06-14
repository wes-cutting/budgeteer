import { type FormEvent, useState } from "react";
import { type Api, ApiError, type EnvelopeView } from "./api";

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <form onSubmit={onSubmit} aria-label="Move money between envelopes">
      <label>
        From envelope
        <select value={fromEnvelopeId} onChange={(e) => setFromEnvelopeId(e.target.value)}>
          <option value="">Select…</option>
          {active.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        To envelope
        <select value={toEnvelopeId} onChange={(e) => setToEnvelopeId(e.target.value)}>
          <option value="">Select…</option>
          {active.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Amount <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        Memo <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        Move money
      </button>
    </form>
  );
}
