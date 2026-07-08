import { Fragment, useEffect, useId, useState } from "react";
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
import { ConfirmDialog, Field, Input, Select, Skeleton } from "./ui";
import ledger from "./Ledgers.module.css";
import form from "./FormLayout.module.css";
import styles from "./RecurringView.module.css";

const FREQUENCIES: RecurringFrequency[] = ["weekly", "biweekly", "monthly"];

/** Recurring rules (FEAT-009): define a scheduled transaction + split, and "Post due" to generate. */
export function RecurringView({ api }: { api: Api }) {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [envelopes, setEnvelopes] = useState<EnvelopeView[]>([]);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Per-row split disclosure (UXR5 §2) — collapsed by default, not persisted.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // UX12 — deleting a rule (schedule + split) is non-trivial to reconstruct, so confirm first (§4).
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null);

  const [accountId, setAccountId] = useState("");
  const [kind, setKind] = useState<"deposit" | "withdrawal">("withdrawal");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [anchorOn, setAnchorOn] = useState(localToday());
  const [submitting, setSubmitting] = useState(false);
  const fid = useId();

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

  function toggle(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeEnvelopes = envelopes
    .filter((e) => e.archivedAt === null)
    .map((e) => ({ id: e.id, name: e.name }));

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
          // FEAT-UXR5 — the rule form on the UXR4 form-layout pattern: a grouped fieldset, every
          // control via the UX4 `Field`/`Input`/`Select` primitives, natural pairs gridded
          // (Amount+Payee, Frequency+First date) and stacking ≤ 640px. The carried Deposit/Withdrawal
          // radiogroup and the shared AllocationEditor (the rule's split) are unchanged — only their
          // framing adopts the pattern. Behavior is byte-for-byte the same as before.
          <div className={form.form}>
            <form aria-label="New recurring rule" onSubmit={(e) => e.preventDefault()}>
              <fieldset className={form.fieldset}>
                <legend className={form.legend}>New recurring rule</legend>
                <Field label="Account" htmlFor={`${fid}-account`}>
                  <Select
                    id={`${fid}-account`}
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
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
                <div className={form.fieldRow}>
                  <Field label="Amount" htmlFor={`${fid}-amount`}>
                    <Input
                      id={`${fid}-amount`}
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </Field>
                  <Field label="Payee" htmlFor={`${fid}-payee`}>
                    <Input
                      id={`${fid}-payee`}
                      value={payee}
                      onChange={(e) => setPayee(e.target.value)}
                    />
                  </Field>
                </div>
                <div className={form.fieldRow}>
                  <Field label="Frequency" htmlFor={`${fid}-frequency`}>
                    <Select
                      id={`${fid}-frequency`}
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="First date" htmlFor={`${fid}-first-date`}>
                    <Input
                      id={`${fid}-first-date`}
                      value={anchorOn}
                      onChange={(e) => setAnchorOn(e.target.value)}
                    />
                  </Field>
                </div>
              </fieldset>
            </form>
            <AllocationEditor
              magnitudeCents={magnitudeCents}
              envelopes={activeEnvelopes}
              submitting={submitting}
              saveLabel="Create recurring rule"
              onSave={(lines) => void createRule(lines)}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="rules-heading">
        <h2 id="rules-heading">Your recurring rules</h2>
        {rules === null ? (
          <Skeleton />
        ) : rules.length === 0 ? (
          <p>No recurring rules yet — add one above.</p>
        ) : (
          // FEAT-UXR5 — the rules list becomes a real table on the shared UXR3 treatment
          // (Ledgers.module.css, reused verbatim). Payee is surfaced as its own column (§2 — data the
          // list never rendered); Amount is SIGNED by direction and right-aligned; the split moves out
          // of the row into a per-row disclosure (aria-expanded) that reveals an indented detail region.
          <div className="table-scroll" tabIndex={0} role="group" aria-label="Recurring rules">
            <table className={ledger.table}>
              <caption className="sr-only">Recurring rules</caption>
              <thead>
                <tr>
                  <th scope="col">Payee</th>
                  <th scope="col">Account</th>
                  <th scope="col" className={ledger.numeric}>
                    Amount
                  </th>
                  <th scope="col">Frequency</th>
                  <th scope="col">Next date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Split</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => {
                  const signedCents = r.direction === "withdrawal" ? -r.amountCents : r.amountCents;
                  const label = r.payee ?? r.accountName; // for per-row accessible names
                  const isOpen = expanded.has(r.id);
                  const detailId = `rec-lines-${r.id}`;
                  const n = r.lines.length;
                  return (
                    <Fragment key={r.id}>
                      <tr>
                        <th scope="row">{r.payee ?? "—"}</th>
                        <td>{r.accountName}</td>
                        <td className={ledger.numeric}>{formatCents(signedCents)}</td>
                        <td>{r.frequency}</td>
                        <td>{r.nextOccurrenceOn}</td>
                        <td>{r.dueCount > 0 ? `${r.dueCount} due` : "Up to date"}</td>
                        <td>
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={detailId}
                            aria-label={`Show ${n} line${n === 1 ? "" : "s"} for ${label}`}
                            onClick={() => toggle(r.id)}
                          >
                            {n} {n === 1 ? "line" : "lines"}
                          </button>
                        </td>
                        <td>
                          <div className={ledger.actions}>
                            <button
                              type="button"
                              aria-label={`Delete ${label}`}
                              onClick={() => setPendingDelete(r)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr>
                          <td colSpan={8} className={styles.splitDetail}>
                            <ul id={detailId} className={styles.splitList}>
                              {r.lines.map((l) => (
                                <li key={l.id} className={l.refund ? styles.refund : undefined}>
                                  {l.envelopeName} {formatCents(l.amountCents)}
                                  {l.refund ? " (refund)" : ""}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this rule?"
        description="Generated transactions are kept; the schedule stops. This can’t be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
