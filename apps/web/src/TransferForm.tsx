import { type FormEvent, useId, useState } from "react";
import { type AccountView, type Api, ApiError } from "./api";
import { FieldError } from "./ui";
import { amountFieldError } from "./validation";

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
  const [amountTouched, setAmountTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountErrorId = useId();
  // Inline (UX12d): surface an un-parseable amount as a field-level error once the field is touched;
  // shown live thereafter so it clears as the user fixes it. Positivity/funds stay server-checked.
  const amountError = amountTouched ? amountFieldError(amount) : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!toAccountId) {
      setError("Choose an account to transfer to.");
      return;
    }
    if (amountFieldError(amount)) {
      setAmountTouched(true);
      return; // don't round-trip an amount we already know won't parse
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
            Amount{" "}
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setAmountTouched(true)}
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountError ? amountErrorId : undefined}
            />
          </label>
          {amountError ? <FieldError id={amountErrorId}>{amountError}</FieldError> : null}
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
