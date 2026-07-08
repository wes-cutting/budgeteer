import { useEffect, useState } from "react";
import {
  type AccountView,
  type AllocationDraft,
  type Api,
  ApiError,
  type EnvelopeView,
  type RecurringFrequency,
  type RecurringView as Rule,
} from "./api";
import { tryParseMoney } from "@budgeteer/domain";
import { localToday } from "./dates";
import { formatCents } from "./format";
import { AllocationEditor } from "./AllocationEditor";
import { Skeleton } from "./ui";

const FREQUENCIES: RecurringFrequency[] = ["weekly", "biweekly", "monthly"];

/** Recurring rules (FEAT-009): define a scheduled transaction + split, and "Post due" to generate. */
export function RecurringView({ api }: { api: Api }) {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [envelopes, setEnvelopes] = useState<EnvelopeView[]>([]);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [accountId, setAccountId] = useState("");
  const [kind, setKind] = useState<"deposit" | "withdrawal">("withdrawal");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [anchorOn, setAnchorOn] = useState(localToday());
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [accs, envs, recs] = await Promise.all([
        api.listAccounts(),
        api.listEnvelopes(),
        api.listRecurring(),
      ]);
      setAccounts(accs);
      setEnvelopes(envs);
      setRules(recs);
      setAccountId((cur) => (cur === "" ? (accs[0]?.id ?? "") : cur));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't load recurring rules.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const magnitudeCents = tryParseMoney(amount) ?? 0;

  async function createRule(lines: AllocationDraft[]) {
    setError(null);
    setNotice(null);
    if (!accountId) {
      setError("Choose an account.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createRecurring({
        accountId,
        kind,
        amount,
        payee: payee.trim() === "" ? undefined : payee,
        frequency,
        anchorOn,
        lines,
      });
      setAmount("");
      setPayee("");
      await load();
      setNotice("Recurring rule created.");
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the rule.");
    } finally {
      setSubmitting(false);
    }
  }

  async function postDue() {
    setError(null);
    setNotice(null);
    try {
      const res = await api.postDueRecurring();
      await load();
      setNotice(
        res.posted === 0
          ? "Nothing due right now."
          : `Posted ${res.posted} transaction${res.posted === 1 ? "" : "s"}.`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't post due transactions.");
    }
  }

  async function remove(id: string) {
    setError(null);
    setNotice(null);
    try {
      await api.deleteRecurring(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete the rule.");
    }
  }

  return (
    <main>
      {/* FEAT-UXR1 — the page title is the shell's single <h1> (top bar); this view drops its own. */}
      <header>
        <button type="button" onClick={() => void postDue()}>
          Post due
        </button>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}

      <section aria-labelledby="new-recurring-heading">
        <h2 id="new-recurring-heading">New recurring rule</h2>
        {accounts.length === 0 ? (
          <p>Add an account first.</p>
        ) : (
          <>
            <form aria-label="New recurring rule" onSubmit={(e) => e.preventDefault()}>
              <label>
                Account
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <div role="radiogroup" aria-label="Transaction type">
                <label>
                  <input
                    type="radio"
                    name="rec-kind"
                    checked={kind === "deposit"}
                    onChange={() => setKind("deposit")}
                  />{" "}
                  Deposit
                </label>
                <label>
                  <input
                    type="radio"
                    name="rec-kind"
                    checked={kind === "withdrawal"}
                    onChange={() => setKind("withdrawal")}
                  />{" "}
                  Withdrawal
                </label>
              </div>
              <label>
                Amount{" "}
                <input
                  aria-label="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Payee{" "}
                <input
                  aria-label="Payee"
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                />
              </label>
              <label>
                Frequency
                <select
                  aria-label="Frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                First date{" "}
                <input
                  aria-label="First date"
                  value={anchorOn}
                  onChange={(e) => setAnchorOn(e.target.value)}
                />
              </label>
            </form>
            <AllocationEditor
              magnitudeCents={magnitudeCents}
              envelopes={envelopes
                .filter((e) => e.archivedAt === null)
                .map((e) => ({ id: e.id, name: e.name }))}
              submitting={submitting}
              saveLabel="Create recurring rule"
              onSave={(lines) => void createRule(lines)}
            />
          </>
        )}
      </section>

      <section aria-labelledby="rules-heading">
        <h2 id="rules-heading">Your recurring rules</h2>
        {rules === null ? (
          <Skeleton />
        ) : rules.length === 0 ? (
          <p>No recurring rules yet — add one above.</p>
        ) : (
          <ul aria-label="Recurring rules">
            {rules.map((r) => (
              <li key={r.id}>
                <span>{r.accountName}</span> <span>{r.direction}</span>{" "}
                <span>{formatCents(r.amountCents)}</span> <span>{r.frequency}</span>{" "}
                <span>next {r.nextOccurrenceOn}</span>{" "}
                {r.dueCount > 0 ? <span>{r.dueCount} due</span> : <span>up to date</span>}{" "}
                <span>
                  {r.lines
                    .map(
                      (l) =>
                        `${l.envelopeName} ${formatCents(l.amountCents)}${l.refund ? " (refund)" : ""}`,
                    )
                    .join(", ")}
                </span>
                <button type="button" onClick={() => void remove(r.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
