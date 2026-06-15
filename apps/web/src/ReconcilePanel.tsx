import { type FormEvent, useEffect, useState } from "react";
import { type Api, ApiError, type ReconciliationView } from "./api";
import { formatCents, parseCents } from "./format";

/** Reconcile to bank (FEAT-010): compare Budgeteer's derived balance to the real bank balance. */
export function ReconcilePanel({
  api,
  accountId,
  derivedBalanceCents,
}: {
  api: Api;
  accountId: string;
  derivedBalanceCents: number;
}) {
  const [statement, setStatement] = useState("");
  const [history, setHistory] = useState<ReconciliationView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setHistory(await api.listReconciliations(accountId));
    } catch {
      // history is non-critical; ignore load errors here
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const statementCents = statement.trim() === "" ? null : parseCents(statement);
  const differenceCents = statementCents === null ? null : statementCents - derivedBalanceCents;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (statementCents === null) {
      setError("Enter your bank balance (e.g. 1234.56).");
      return;
    }
    setSubmitting(true);
    try {
      const rec = await api.createReconciliation(accountId, { statementBalance: statement });
      setNotice(
        rec.matched
          ? "Reconciled — matches your bank."
          : `Recorded — off by ${formatCents(Math.abs(rec.differenceCents))}.`,
      );
      setStatement("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Couldn't record the reconciliation.");
    } finally {
      setSubmitting(false);
    }
  }

  const last = history[0];

  return (
    <section aria-labelledby="reconcile-heading">
      <h2 id="reconcile-heading">Reconcile</h2>
      <p>Budgeteer balance: {formatCents(derivedBalanceCents)}</p>
      <form aria-label="Reconcile" onSubmit={onSubmit}>
        <label>
          Your bank balance{" "}
          <input
            aria-label="Bank balance"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
        </label>
        {differenceCents !== null ? (
          <p>
            {differenceCents === 0
              ? "Matches your bank ✓"
              : `Difference: ${formatCents(differenceCents)} (bank − Budgeteer)`}
          </p>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
        <button type="submit" disabled={submitting}>
          Record reconciliation
        </button>
      </form>
      {last ? (
        <p>
          Last reconciled {formatCents(last.statementBalanceCents)} on {last.reconciledOn}
          {last.matched ? " (matched)" : ` (off by ${formatCents(Math.abs(last.differenceCents))})`}
        </p>
      ) : (
        <p>Not yet reconciled.</p>
      )}
    </section>
  );
}
