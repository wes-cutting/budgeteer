import { useId, useState } from "react";
import {
  type AccountView,
  type AllocationDraft,
  type Api,
  ApiError,
  type EnvelopeView,
  type TemplateView,
} from "./api";
import { tryParseMoney } from "@budgeteer/domain";
import { AllocationEditor } from "./AllocationEditor";
import { FieldError } from "./ui";
import { amountFieldError } from "./validation";

interface Props {
  api: Api;
  /** The fixed account when the form is embedded in a register. Omit when `accounts` is supplied
   *  (the global quick-add, UX7) — the user then picks the account in-form. */
  accountId?: string;
  /** When provided, the form renders an Account picker and the user chooses which account to post
   *  to (the register knows its account; the global quick-add does not). */
  accounts?: AccountView[];
  envelopes: EnvelopeView[];
  templates?: TemplateView[];
  onCreated: () => void;
  onSaveAsTemplate?: (name: string, lines: AllocationDraft[]) => void;
}

export function AddTransactionForm({
  api,
  accountId,
  accounts,
  envelopes,
  templates,
  onCreated,
  onSaveAsTemplate,
}: Props) {
  const showAccountPicker = accounts !== undefined;
  const [selectedAccountId, setSelectedAccountId] = useState(accountId ?? "");
  const [kind, setKind] = useState<"deposit" | "withdrawal">("withdrawal");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [amountTouched, setAmountTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountErrorId = useId();
  // Inline (UX12d): an un-parseable amount surfaces field-level on blur (live thereafter). The
  // AllocationEditor already disables Save when the amount can't parse (magnitudeCents falls to 0);
  // this message tells the user *why* the button is disabled instead of leaving it silent.
  const amountError = amountTouched ? amountFieldError(amount) : null;

  const magnitudeCents = tryParseMoney(amount) ?? 0;
  // Picker mode resolves the account from the in-form select; embedded mode uses the fixed prop.
  const effectiveAccountId = showAccountPicker ? selectedAccountId : (accountId ?? "");

  async function save(allocations: AllocationDraft[]) {
    if (effectiveAccountId === "") {
      setError("Choose an account.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.createTransaction(effectiveAccountId, {
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
      {showAccountPicker ? (
        <label>
          Account{" "}
          <select
            aria-label="Account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            <option value="">Choose an account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
          onBlur={() => setAmountTouched(true)}
          aria-invalid={amountError ? true : undefined}
          aria-describedby={amountError ? amountErrorId : undefined}
        />
      </label>
      {amountError ? <FieldError id={amountErrorId}>{amountError}</FieldError> : null}
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
        envelopes={envelopes
          .filter((e) => e.archivedAt === null)
          .map((e) => ({ id: e.id, name: e.name }))}
        templates={templates}
        submitting={submitting}
        // In picker mode, hold Save until an account is chosen (the editor otherwise only gates on
        // amount/allocation); embedded mode never blocks on this.
        disabled={showAccountPicker && selectedAccountId === ""}
        saveLabel="Save transaction"
        onSave={save}
        onSaveAsTemplate={onSaveAsTemplate}
      />
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
