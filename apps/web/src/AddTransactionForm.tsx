import { useState } from "react";
import { type AllocationDraft, type Api, ApiError, type EnvelopeView } from "./api";
import { parseCents } from "./format";
import { AllocationEditor } from "./AllocationEditor";

interface Props {
  api: Api;
  accountId: string;
  envelopes: EnvelopeView[];
  onCreated: () => void;
}

export function AddTransactionForm({ api, accountId, envelopes, onCreated }: Props) {
  const [kind, setKind] = useState<"deposit" | "withdrawal">("withdrawal");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const magnitudeCents = parseCents(amount) ?? 0;

  async function save(allocations: AllocationDraft[]) {
    setError(null);
    setSubmitting(true);
    try {
      await api.createTransaction(accountId, {
        kind,
        amount,
        occurredOn,
        payee: payee.trim() === "" ? undefined : payee,
        allocations,
      });
      setAmount("");
      setPayee("");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Couldn't save — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form aria-label="Add transaction" onSubmit={(e) => e.preventDefault()}>
      <div role="radiogroup" aria-label="Transaction type">
        <label>
          <input
            type="radio"
            name="txn-kind"
            checked={kind === "deposit"}
            onChange={() => setKind("deposit")}
          />{" "}
          Deposit
        </label>
        <label>
          <input
            type="radio"
            name="txn-kind"
            checked={kind === "withdrawal"}
            onChange={() => setKind("withdrawal")}
          />{" "}
          Withdrawal
        </label>
      </div>
      <label>
        Amount{" "}
        <input
          aria-label="Transaction amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label>
        Date{" "}
        <input
          aria-label="Date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
        />
      </label>
      <label>
        Payee <input aria-label="Payee" value={payee} onChange={(e) => setPayee(e.target.value)} />
      </label>
      <AllocationEditor
        magnitudeCents={magnitudeCents}
        envelopes={envelopes.map((e) => ({ id: e.id, name: e.name }))}
        submitting={submitting}
        saveLabel="Save transaction"
        onSave={save}
      />
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
