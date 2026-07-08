import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { type AccountView, type Api, type PayPeriodBucket, type PayPeriodPlanView } from "./api";
import { formatCents } from "./format";
import { Badge, EmptyState, Field, Select, Skeleton } from "./ui";
import styles from "./Insights.module.css";

// The domain PayPeriodBucket (kind · label · committedOn · income · bills · plannedSpend · total ·
// overCommitted · headroomAfter · projectedBalance · reserve).
type Bucket = PayPeriodBucket;

/** Signed display for money that carries direction: "+$2,100.00" / "-$120.00". */
const signedCents = (c: number): string => (c > 0 ? "+" : "") + formatCents(c);

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-07-24" → "Jul 24" (deterministic; no locale dependence, for stable tests). */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${SHORT_MONTHS[Number(m) - 1] ?? m} ${Number(d)}`;
}
/** "2026-08" → "August 2026" (month-subtotal label). */
function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${FULL_MONTHS[Number(m) - 1] ?? month} ${y}`;
}

/** The "Covered by" text for a bucket — the permanent structural join (never colour alone). */
function coveredByLabel(bucket: Bucket): string {
  return bucket.kind === "balance" ? "Current balance" : `${shortDate(bucket.committedOn)} check`;
}

/** The paycheck ledger's Payday label. */
function paydayLabel(bucket: Bucket): string {
  return bucket.kind === "balance" ? "Current balance" : shortDate(bucket.committedOn);
}

/** One flattened bill occurrence, tagged with the bucket that covers it (for the join + highlight). */
interface BillRow {
  label: string;
  dueOn: string;
  amountCents: number;
  bucketIndex: number;
  coveredBy: string;
}

/** One month's bills plus its running month-scoped "left to pay" countdown (the sheet's Total). */
interface MonthGroup {
  month: string; // YYYY-MM
  rows: (BillRow & { leftToPayCents: number })[];
  subtotalCents: number;
}

/**
 * Flatten every bucket's bills into due-ordered month groups, computing the sheet's two countdown
 * scopes CLIENT-SIDE from the bills already in the response (UX spec §11 Q3): the per-row
 * "left to pay" is month-scoped — Σ of this bill and all later bills IN ITS MONTH (resetting at each
 * boundary) — and the pane-level figure is the whole-horizon Σ.
 */
function billLedger(buckets: readonly Bucket[]): {
  groups: MonthGroup[];
  horizonTotalCents: number;
} {
  const rows: BillRow[] = buckets.flatMap((bucket, bucketIndex) =>
    bucket.bills.map((b) => ({
      label: b.label,
      dueOn: b.dueOn,
      amountCents: b.amountCents,
      bucketIndex,
      coveredBy: coveredByLabel(bucket),
    })),
  );
  rows.sort((a, b) =>
    a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.label.localeCompare(b.label),
  );

  const byMonth = new Map<string, BillRow[]>();
  for (const r of rows) {
    const key = r.dueOn.slice(0, 7);
    const g = byMonth.get(key);
    if (g) g.push(r);
    else byMonth.set(key, [r]);
  }

  const groups: MonthGroup[] = [];
  for (const [month, monthRows] of byMonth) {
    const subtotalCents = monthRows.reduce((s, r) => s + r.amountCents, 0);
    // Month-scoped countdown: suffix sum — the first bill shows the month's whole total, the last
    // just itself.
    let running = subtotalCents;
    const withCountdown = monthRows.map((r) => {
      const row = { ...r, leftToPayCents: running };
      running -= r.amountCents;
      return row;
    });
    groups.push({ month, rows: withCountdown, subtotalCents });
  }
  const horizonTotalCents = rows.reduce((s, r) => s + r.amountCents, 0);
  return { groups, horizonTotalCents };
}

/**
 * FEAT-UXR2 — the first-class pay-period planner at `/pay-periods` (promoted from the S7 Insights
 * tab). The stacked per-check sections are re-laid as TWO side-by-side ledgers restoring the sheet's
 * at-a-glance whole-horizon read: a **Bills** ledger (bill · due · amount · month-scoped left-to-pay
 * countdown · covered-by) and a **Paycheck** ledger (payday · income · committed · per-check headroom
 * · projected balance · reserve · status). Selecting a payday highlights its covered bills — an
 * ADDITION to the permanent "Covered by" text column, never the only join (WCAG 1.4.1). The domain
 * policy (balanced latest-fit, SPIKE-10) and the plan math are unchanged from S7; the shell owns the
 * page `<h1>`, so this view renders `<h2>`+.
 */
export function PayPeriodsView({ api }: { api: Api }) {
  const [accounts, setAccounts] = useState<AccountView[] | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [plan, setPlan] = useState<PayPeriodPlanView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

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
    setSelected(null);
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
      {/* FEAT-UXR1 — the page title is the shell's single <h1> (top bar); this view drops its own,
          so the two ledger panes are its top-level headings (<h2>). */}
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
            Every bill in the horizon and every payday&rsquo;s position on one screen: each expected
            paycheck covers the bills it funds (arriving at least {plan?.leadDays ?? 7} days before
            each due date); the paycheck ledger&rsquo;s headroom, balance, and reserve show whether
            the plan stays viable.
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
            <Planner plan={plan} selected={selected} onSelect={setSelected} />
          )}
        </>
      )}
    </main>
  );
}

function Planner({
  plan,
  selected,
  onSelect,
}: {
  plan: PayPeriodPlanView;
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  const { groups, horizonTotalCents } = useMemo(() => billLedger(plan.buckets), [plan.buckets]);
  // The first bucket whose running headroom dips negative is the break; later negatives are "Short".
  const firstBreakIndex = plan.buckets.findIndex((b) => b.headroomAfterCents < 0);
  const selectedBucket = selected !== null ? plan.buckets[selected] : undefined;
  const announcement =
    selectedBucket === undefined
      ? ""
      : `${coveredByLabel(selectedBucket)} — covers ${selectedBucket.bills.length} ${
          selectedBucket.bills.length === 1 ? "bill" : "bills"
        }`;

  return (
    <>
      {/* Politely announce the join on selection (the highlight is visual; this is its text pair). */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className={styles.ledgers}>
        <BillsPane groups={groups} horizonTotalCents={horizonTotalCents} selected={selected} />
        <PaychecksPane
          plan={plan}
          firstBreakIndex={firstBreakIndex}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
    </>
  );
}

function BillsPane({
  groups,
  horizonTotalCents,
  selected,
}: {
  groups: MonthGroup[];
  horizonTotalCents: number;
  selected: number | null;
}) {
  return (
    <section className={styles.billsPane} aria-labelledby="bills-heading">
      <h2 id="bills-heading">Bills</h2>
      <p className={styles.paneFigure}>
        Left to pay, next 90 days: <strong>{formatCents(horizonTotalCents)}</strong>
      </p>
      {groups.length === 0 ? (
        <p>No bills in this horizon.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="group" aria-labelledby="bills-heading">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Bill</th>
                <th scope="col">Due</th>
                <th scope="col" className={styles.numeric}>
                  Amount
                </th>
                <th scope="col" className={styles.numeric}>
                  Left to pay
                </th>
                <th scope="col">Covered by</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.month}>
                {g.rows.map((r, j) => (
                  <tr
                    key={`${r.dueOn}:${r.label}:${j}`}
                    className={r.bucketIndex === selected ? styles.selectedRow : undefined}
                  >
                    <th scope="row">{r.label}</th>
                    <td>{shortDate(r.dueOn)}</td>
                    <td className={styles.numeric}>{formatCents(r.amountCents)}</td>
                    <td className={styles.numeric}>{formatCents(r.leftToPayCents)}</td>
                    <td>{r.coveredBy}</td>
                  </tr>
                ))}
                <tr className={styles.subtotalRow}>
                  <th scope="row" colSpan={3}>
                    {monthLabel(g.month)} remaining
                  </th>
                  <td className={styles.numeric}>{formatCents(g.subtotalCents)}</td>
                  <td />
                </tr>
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

/** The combined S7 status (carried over exactly): the first running-headroom break is the most
 *  severe, then over-committed-but-still-covered, then covered. Text badge — never colour alone. */
function statusBadge(bucket: Bucket, index: number, firstBreakIndex: number) {
  if (bucket.headroomAfterCents < 0) {
    return index === firstBreakIndex ? (
      <Badge tone="danger">Plan breaks here</Badge>
    ) : (
      <Badge tone="danger">Short</Badge>
    );
  }
  if (bucket.overCommitted) return <Badge tone="warning">Over-committed</Badge>;
  return <Badge tone="success">Covered</Badge>;
}

function PaychecksPane({
  plan,
  firstBreakIndex,
  selected,
  onSelect,
}: {
  plan: PayPeriodPlanView;
  firstBreakIndex: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  return (
    <section className={styles.paychecksPane} aria-labelledby="paychecks-heading">
      <h2 id="paychecks-heading">Paychecks</h2>
      <div className="table-scroll" tabIndex={0} role="group" aria-labelledby="paychecks-heading">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Payday</th>
              <th scope="col" className={styles.numeric}>
                Income
              </th>
              <th scope="col" className={styles.numeric}>
                Committed
              </th>
              <th scope="col" className={styles.numeric}>
                Headroom
              </th>
              <th scope="col" className={styles.numeric}>
                Balance
              </th>
              <th scope="col" className={styles.numeric}>
                Reserve
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {plan.buckets.map((bucket, index) => {
              const perCheckHeadroom = bucket.incomeCents - bucket.totalCents;
              const isSelected = index === selected;
              return (
                <tr key={`${bucket.committedOn}:${index}`}>
                  <th scope="row">
                    <button
                      type="button"
                      className={styles.paydayButton}
                      aria-pressed={isSelected}
                      // The visible payday is within the accessible name (WCAG 2.5.3 label-in-name).
                      aria-label={`Highlight bills covered by ${coveredByLabel(bucket)}`}
                      onClick={() => onSelect(isSelected ? null : index)}
                    >
                      {paydayLabel(bucket)}
                    </button>
                    {bucket.plannedSpendCents > 0 ? (
                      <span className={styles.plannedSub}>
                        Planned spending {formatCents(bucket.plannedSpendCents)}
                      </span>
                    ) : null}
                  </th>
                  <td className={styles.numeric}>
                    {bucket.kind === "balance" ? "—" : signedCents(bucket.incomeCents)}
                  </td>
                  <td className={styles.numeric}>{formatCents(bucket.totalCents)}</td>
                  <td className={styles.numeric}>{signedCents(perCheckHeadroom)}</td>
                  <td className={styles.numeric}>{formatCents(bucket.projectedBalanceCents)}</td>
                  <td className={styles.numeric}>{formatCents(bucket.reserveCents)}</td>
                  <td>{statusBadge(bucket, index, firstBreakIndex)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
