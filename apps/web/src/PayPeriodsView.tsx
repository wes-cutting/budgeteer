import { useEffect, useState } from "react";
import { Link } from "react-router";
import { type AccountView, type Api, type PayPeriodPlanView } from "./api";
import { formatCents } from "./format";
import { Badge, EmptyState, Field, Select, Skeleton } from "./ui";
import styles from "./Insights.module.css";

/** Signed display for money that carries direction: "+$2,100.00" / "-$120.00". */
const signedCents = (c: number): string => (c > 0 ? "+" : "") + formatCents(c);

/**
 * Insights — pay periods (FEAT-S7): the sheet's paycheck buckets, derived. Each expected paycheck
 * is a section listing exactly the bills it must cover (balanced latest-fit, SPIKE-10), that
 * period's planned-spending share (SPIKE-05 netting), the bucket total, and the commitment-time
 * headroom line (S8). The bucket join is STRUCTURE + text — one `<h3>` per bucket, bills grouped
 * inside it — never colour (the sheet's blue/red border language, superseded per ADR-0007/UX13).
 */
export function PayPeriodsView({ api }: { api: Api }) {
  const [accounts, setAccounts] = useState<AccountView[] | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [plan, setPlan] = useState<PayPeriodPlanView | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the account list once; default to the first non-archived account (Forecast convention).
  useEffect(() => {
    let active = true;
    api
      .listAccounts()
      .then((list) => {
        if (!active) return;
        const open = list.filter((a) => a.archivedAt === null);
        setAccounts(open);
        if (open.length > 0 && open[0]) setAccountId(open[0].id);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load accounts.");
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setPlan(null);
    setError(null);
    api
      .getPayPeriodPlan(accountId)
      .then((p) => {
        if (active) setPlan(p);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the plan.");
      });
    return () => {
      active = false;
    };
  }, [api, accountId]);

  return (
    <main>
      <header>
        <h1>Insights — pay periods</h1>
      </header>

      {accounts !== null && accounts.length === 0 ? (
        <p>Add an account first, then come back to plan its pay periods.</p>
      ) : (
        <>
          <div className={styles.controls}>
            <Field label="Account" htmlFor="payperiods-account">
              <Select
                id="payperiods-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p>
            Each expected paycheck is committed to the bills it funds (arriving at least{" "}
            {plan?.leadDays ?? 7} days before each due date) plus that period&rsquo;s expected
            spending; headroom shows whether everything already committed stays covered.
          </p>

          {error ? <p role="alert">{error}</p> : null}
          {error ? null : plan === null ? (
            <Skeleton />
          ) : plan.buckets.filter((b) => b.kind === "paycheck").length === 0 ? (
            <EmptyState title="No expected paychecks">
              <p>
                Add a recurring <strong>deposit</strong> rule (e.g. your paycheck) on the{" "}
                <Link to="/recurring">Recurring</Link> page to plan pay periods.
              </p>
            </EmptyState>
          ) : (
            <PlanBuckets plan={plan} />
          )}
        </>
      )}
    </main>
  );
}

function PlanBuckets({ plan }: { plan: PayPeriodPlanView }) {
  // The first bucket whose headroom dips negative reads "Plan breaks here"; later negative
  // buckets read "Short" (they inherit the break). Text badges — never colour alone.
  const firstBreakIndex = plan.buckets.findIndex((b) => b.headroomAfterCents < 0);
  return (
    <>
      {plan.buckets.map((bucket, i) => {
        const heading =
          bucket.kind === "balance"
            ? "From current balance"
            : `${bucket.label} · ${bucket.committedOn} · ${signedCents(bucket.incomeCents)}`;
        const first = bucket.bills[0];
        const last = bucket.bills[bucket.bills.length - 1];
        const coverage =
          first === undefined
            ? "No bills assigned."
            : bucket.bills.length === 1
              ? `Covers 1 bill due ${first.dueOn}.`
              : `Covers ${bucket.bills.length} bills due ${first.dueOn} – ${last?.dueOn}.`;
        return (
          <section key={`${bucket.committedOn}:${i}`} aria-label={heading}>
            <h3>
              {heading} {bucket.overCommitted ? <Badge tone="warning">Over-committed</Badge> : null}
            </h3>
            <p>{coverage}</p>
            {bucket.bills.length > 0 || bucket.plannedSpendCents > 0 ? (
              <div
                className="table-scroll"
                tabIndex={0}
                role="group"
                aria-label={`Bills — ${heading}`}
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Bill</th>
                      <th scope="col">Due</th>
                      <th scope="col" className={styles.numeric}>
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucket.bills.map((b, j) => (
                      <tr key={`${b.dueOn}:${b.label}:${j}`}>
                        <th scope="row">{b.label}</th>
                        <td>{b.dueOn}</td>
                        <td className={styles.numeric}>{formatCents(b.amountCents)}</td>
                      </tr>
                    ))}
                    {bucket.plannedSpendCents > 0 ? (
                      <tr>
                        <th scope="row">Planned spending</th>
                        <td>this period</td>
                        <td className={styles.numeric}>{formatCents(bucket.plannedSpendCents)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
            <dl className={styles.figures}>
              <div>
                <dt>Bucket total</dt>
                <dd>{formatCents(bucket.totalCents)}</dd>
              </div>
              <div>
                <dt>
                  {bucket.kind === "balance"
                    ? "Headroom after these bills"
                    : "Headroom after this check"}
                </dt>
                <dd>
                  {formatCents(bucket.headroomAfterCents)}{" "}
                  {bucket.headroomAfterCents < 0 ? (
                    <Badge tone="danger">
                      {i === firstBreakIndex ? "Plan breaks here" : "Short"}
                    </Badge>
                  ) : (
                    <Badge tone="success">Covered</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        );
      })}
    </>
  );
}
