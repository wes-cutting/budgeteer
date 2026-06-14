import { type FormEvent, useState } from "react";
import { type AccountView, type Api, ApiError } from "./api";

/** Move money from this account to another (account↔account double-entry, FEAT-007). */
export function TransferForm({
  api,
  fromAccount,
  accounts,
  onTransferred,
}: {
  api: Api;
  fromAccount: AccountView;
  accounts: AccountView[];
  onTransferred: () => void;
}) {
  const destinations = accounts.filter((a) => a.id !== fromAccount.id && a.archivedAt === null);
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!toAccountId) {
      setError("Choose an account to transfer to.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createTransfer({
        fromAccountId: fromAccount.id,
        toAccountId,
        amount,
        memo: memo.trim() === "" ? undefined : memo.trim(),
      });
      setToAccountId("");
      setAmount("0.00");
      setMemo("");
      onTransferred();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Couldn't transfer — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="transfer-heading">
      <h2 id="transfer-heading">Transfer money</h2>
      {destinations.length === 0 ? (
        <p>Add another account to transfer money to.</p>
      ) : (
        <form onSubmit={onSubmit} aria-label="Transfer money">
          <label>
            To account
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">Select an account…</option>
              {destinations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
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
            Transfer
          </button>
        </form>
      )}
    </section>
  );
}
