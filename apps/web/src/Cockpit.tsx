import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { isLiabilityKind, stillOwedCents } from "@budgeteer/domain";
import {
  type AccountView,
  type Api,
  type BudgetVsActualReport,
  type CashFlowForecast,
  type PayPeriodPlanView,
  type RecurringView,
  type TransactionView,
} from "./api";
import { localMonth as currentMonth, localMonthRange } from "./dates";
import { formatCents } from "./format";
import { Badge, Card, EmptyState, ProgressBar, Skeleton, type ProgressTone } from "./ui";
import styles from "./Cockpit.module.css";

/**
 * UX5 — the budget + future-planning cockpit at `/`. The home's new headline: it COMPOSES EXISTING
 * READS (fan-out, no new aggregate endpoint — R4/R5 precedent) into five panels, each deep-linking
 * to its detail route (the UX3 shell + routes). Account/envelope management still lives below it on
 * the home (Dashboard) until UX6 demotes that to `/manage`.
 *
 * Each panel fetches independently and degrades on its own (R2/R5): a failed read shows an inline
 * note rather than blanking the cockpit. Figures derive from the ledger and reconcile to it
 * (asserted in Cockpit.test.tsx against the fakeApi, which mirrors the server's derived balances).
 */

type Loadable<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };
const LOADING: Loadable<never> = { status: "loading" };
const FAILED: Loadable<never> = { status: "error" };
function ready<T>(data: T): Loadable<T> {
  return { status: "ready", data };
}

const MONTHS = [
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
/** Current calendar month "YYYY-MM" — the budget endpoint keys targets/spend by month. */
/** "2026-06" → "June 2026" (deterministic; no locale dependence for tests). */
function monthLabel(month: string): string {
  const [year, mo] = month.split("-");
  return `${MONTHS[Number(mo) - 1] ?? month} ${year}`;
}

interface NetWorthSnapshot {
  assetsCents: number;
  liabilitiesCents: number;
  netCents: number;
}

/** Net worth = Σ signed balances, split by account KIND (liability kinds carry debt negative), so
 *  net = assets + liabilities falls out. Same classifier as the R9/R4 path → equal by construction. */
function netWorthOf(accounts: AccountView[]): NetWorthSnapshot {
  let assetsCents = 0;
  let liabilitiesCents = 0;
  for (const a of accounts) {
    if (isLiabilityKind(a.kind)) liabilitiesCents += a.balanceCents;
    else assetsCents += a.balanceCents;
  }
  return { assetsCents, liabilitiesCents, netCents: assetsCents + liabilitiesCents };
}

/** The cash-flow snapshot follows one account: prefer the first active checking account, else the
 *  first active non-liability (e.g. cash/savings) account; null when none qualifies. */
function pickForecastAccount(accounts: AccountView[]): AccountView | null {
  const eligible = accounts.filter((a) => a.archivedAt === null && !isLiabilityKind(a.kind));
  return eligible.find((a) => a.kind === "checking") ?? eligible[0] ?? null;
}

export function Cockpit({ api }: { api: Api }) {
  const month = currentMonth();
  const [budget, setBudget] = useState<Loadable<BudgetVsActualReport>>(LOADING);
  const [needs, setNeeds] = useState<Loadable<TransactionView[]>>(LOADING);
  const [recurring, setRecurring] = useState<Loadable<RecurringView[]>>(LOADING);
  const [netWorth, setNetWorth] = useState<Loadable<NetWorthSnapshot | null>>(LOADING);
  const [forecast, setForecast] = useState<Loadable<CashFlowForecast | null>>(LOADING);
  const [nextPay, setNextPay] = useState<Loadable<PayPeriodPlanView | null>>(LOADING);

  useEffect(() => {
    let active = true;
    api
      .getBudgetVsActual(month)
      .then((r) => {
        if (active) setBudget(ready(r));
      })
      .catch(() => {
        if (active) setBudget(FAILED);
      });
    api
      .listNeedsAllocation()
      .then((t) => {
        if (active) setNeeds(ready(t));
      })
      .catch(() => {
        if (active) setNeeds(FAILED);
      });
    api
      .listRecurring()
      .then((r) => {
        if (active) setRecurring(ready(r));
      })
      .catch(() => {
        if (active) setRecurring(FAILED);
      });
    // One accounts read feeds the net-worth snapshot AND the forecast account pick.
    api
      .listAccounts()
      .then((accounts) => {
        if (!active) return;
        setNetWorth(ready(accounts.length === 0 ? null : netWorthOf(accounts)));
        const acct = pickForecastAccount(accounts);
        if (!acct) {
          setForecast(ready(null));
          setNextPay(ready(null));
          return;
        }
        // One account pick feeds both the forecast and the Next-paycheck line (FEAT-UXR2, Q4). Each
        // read degrades on its own — a failed plan leaves the recurring content intact.
        api
          .getCashFlowForecast(acct.id)
          .then((f) => {
            if (active) setForecast(ready(f));
          })
          .catch(() => {
            if (active) setForecast(FAILED);
          });
        api
          .getPayPeriodPlan(acct.id)
          .then((p) => {
            if (active) setNextPay(ready(p));
          })
          .catch(() => {
            if (active) setNextPay(FAILED);
          });
      })
      .catch(() => {
        if (!active) return;
        setNetWorth(FAILED);
        setForecast(FAILED);
        setNextPay(FAILED);
      });
    return () => {
      active = false;
    };
  }, [api, month]);

  return (
    <section aria-labelledby="overview-heading" className={styles.overview}>
      <h2 id="overview-heading">Overview</h2>
      <div className={styles.grid}>
        <BudgetPanel month={month} state={budget} />
        <NeedsPanel state={needs} />
        <UpcomingPanel state={recurring} nextPay={nextPay} />
        <ForecastPanel state={forecast} />
        <NetWorthPanel state={netWorth} />
      </div>
    </section>
  );
}

function Panel({
  title,
  link,
  children,
}: {
  title: string;
  link?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <Card className={styles.panel}>
      <h3 className={styles.panelTitle}>{title}</h3>
      <div className={styles.panelBody}>{children}</div>
      {link ? (
        <Link to={link.to} className={styles.panelLink}>
          {link.label}
        </Link>
      ) : null}
    </Card>
  );
}

/** Loading → skeleton; error → an inline (non-alert) note; ready → the panel's body. */
function renderState<T>(state: Loadable<T>, render: (data: T) => ReactNode): ReactNode {
  if (state.status === "loading") return <Skeleton rows={2} />;
  if (state.status === "error")
    return <p className={styles.muted}>Couldn&apos;t load this panel.</p>;
  return render(state.data);
}

/** A term/value figure list (description list — no role override; keeps dt/dd containment). A
 *  `negative` figure gets weight + danger tone (UX13); the value's minus sign stays the non-colour
 *  signal, so colour is never the sole encoding. */
function Figures({ items }: { items: { term: string; value: string; negative?: boolean }[] }) {
  return (
    <dl className={styles.figures}>
      {items.map((it) => (
        <div key={it.term}>
          <dt>{it.term}</dt>
          <dd className={it.negative ? styles.negative : undefined}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BudgetPanel({ month, state }: { month: string; state: Loadable<BudgetVsActualReport> }) {
  const budgeted =
    state.status === "ready" ? state.data.rows.filter((r) => r.targetCents !== null) : [];
  const link =
    state.status === "ready" && budgeted.length > 0
      ? { to: "/insights/budget", label: "Review budget" }
      : undefined;
  return (
    <Panel title="This month's budget" link={link}>
      {renderState(state, () => {
        if (budgeted.length === 0) {
          return (
            <EmptyState title="No monthly targets yet">
              Set a target on an envelope to track budget health.
            </EmptyState>
          );
        }
        // Sum over TARGETED envelopes only, so the three figures reconcile (budgeted − spent =
        // remaining). The report's totalSpent also counts spend on untargeted envelopes, which
        // would break that identity; budget health is about the envelopes you set a target on.
        const budgetedCents = budgeted.reduce((s, r) => s + (r.targetCents ?? 0), 0);
        const spentCents = budgeted.reduce((s, r) => s + r.spentCents, 0);
        const remainingCents = budgetedCents - spentCents;
        const overBudget = budgeted.filter(
          (r) => r.remainingCents !== null && r.remainingCents < 0,
        ).length;
        const ratio = budgetedCents > 0 ? spentCents / budgetedCents : 0;
        const tone: ProgressTone =
          remainingCents < 0 ? "over" : ratio >= 0.8 ? "caution" : "accent";
        return (
          <>
            <p className={styles.muted}>{monthLabel(month)}</p>
            <Figures
              items={[
                { term: "Budgeted", value: formatCents(budgetedCents) },
                { term: "Spent", value: formatCents(spentCents) },
                {
                  term: "Remaining",
                  value: formatCents(remainingCents),
                  negative: remainingCents < 0,
                },
              ]}
            />
            <ProgressBar ratio={ratio} tone={tone} className={styles.progress} />
            {overBudget > 0 ? (
              <Badge tone="warning">
                {overBudget} {overBudget === 1 ? "envelope" : "envelopes"} over budget
              </Badge>
            ) : (
              <Badge tone="success">On track</Badge>
            )}
          </>
        );
      })}
    </Panel>
  );
}

function NeedsPanel({ state }: { state: Loadable<TransactionView[]> }) {
  const link =
    state.status === "ready" && state.data.length > 0
      ? { to: "/needs-allocation", label: "Allocate now" }
      : undefined;
  return (
    <Panel title="Needs allocation" link={link}>
      {renderState(state, (txns) => {
        if (txns.length === 0) {
          return <p className={styles.muted}>Everything is allocated.</p>;
        }
        const unallocated = txns.reduce((s, t) => s + Math.abs(t.unallocatedCents), 0);
        return (
          <>
            <p className={styles.bigNumber}>{txns.length}</p>
            <p>{txns.length === 1 ? "transaction needs" : "transactions need"} allocation</p>
            <p className={styles.muted}>{formatCents(unallocated)} unallocated</p>
          </>
        );
      })}
    </Panel>
  );
}

function UpcomingPanel({
  state,
  nextPay,
}: {
  state: Loadable<RecurringView[]>;
  nextPay: Loadable<PayPeriodPlanView | null>;
}) {
  const link =
    state.status === "ready" && state.data.length > 0
      ? { to: "/recurring", label: "Manage recurring" }
      : undefined;
  return (
    <Panel title="Upcoming" link={link}>
      {renderState(state, (rules) => {
        if (rules.length === 0) {
          return (
            <EmptyState title="No recurring transactions">
              Add rent, paychecks, or subscriptions to see what is coming.
            </EmptyState>
          );
        }
        const dueNow = rules.reduce((s, r) => s + r.dueCount, 0);
        // FEAT-S9: the sheet's D-column countdown, derived — Σ unposted withdrawal occurrences
        // through the last day of the user's local month (past-due unposted count; posting clears).
        const owedCents = stillOwedCents(rules, localMonthRange().to);
        const soon = [...rules]
          .sort((a, b) => a.nextOccurrenceOn.localeCompare(b.nextOccurrenceOn))
          .slice(0, 4);
        return (
          <>
            {dueNow > 0 ? <Badge tone="warning">{dueNow} due to post</Badge> : null}
            <Figures items={[{ term: "Still owed this month", value: formatCents(owedCents) }]} />
            <NextPaycheckLine state={nextPay} />
            <ul className={styles.list} aria-label="Upcoming recurring">
              {soon.map((r) => (
                <li key={r.id}>
                  <span>{r.payee ?? (r.direction === "deposit" ? "Deposit" : "Withdrawal")}</span>{" "}
                  <span className={styles.amount}>
                    {r.direction === "deposit" ? "+" : "-"}
                    {formatCents(r.amountCents)}
                  </span>{" "}
                  <span className={styles.muted}>{r.nextOccurrenceOn}</span>
                </li>
              ))}
            </ul>
          </>
        );
      })}
    </Panel>
  );
}

/** FEAT-UXR2 (Q4) — the Upcoming panel's deep-link into the pay-period planner: the next payday,
 *  what it must cover, and its headroom badge. Degrades to nothing when the plan can't load or has
 *  no expected paycheck — the recurring list carries the panel on its own. */
function NextPaycheckLine({ state }: { state: Loadable<PayPeriodPlanView | null> }) {
  if (state.status !== "ready" || state.data === null) return null;
  const next = state.data.buckets.find((b) => b.kind === "paycheck");
  if (next === undefined) return null;
  const headroomCents = next.incomeCents - next.totalCents;
  return (
    <p className={styles.nextPay}>
      <Link to="/pay-periods">Next paycheck {next.committedOn}</Link>{" "}
      <span className={styles.muted}>· {formatCents(next.totalCents)} committed</span>{" "}
      {headroomCents >= 0 ? (
        <Badge tone="success">+{formatCents(headroomCents)} headroom</Badge>
      ) : (
        <Badge tone="danger">{formatCents(headroomCents)} over</Badge>
      )}
    </p>
  );
}

function ForecastPanel({ state }: { state: Loadable<CashFlowForecast | null> }) {
  const link =
    state.status === "ready" && state.data !== null
      ? { to: "/insights/forecast", label: "View forecast" }
      : undefined;
  return (
    <Panel title="Cash-flow forecast" link={link}>
      {renderState(state, (forecast) => {
        if (forecast === null) {
          return (
            <EmptyState title="No forecast yet">
              Add a checking account to project your cash flow.
            </EmptyState>
          );
        }
        return (
          <>
            <p className={styles.muted}>
              {forecast.accountName} · next {forecast.horizonDays} days
            </p>
            <Figures
              items={[
                { term: "Now", value: formatCents(forecast.startingBalanceCents) },
                { term: "Projected end", value: formatCents(forecast.endingBalanceCents) },
                { term: "Lowest", value: formatCents(forecast.minBalanceCents) },
              ]}
            />
            {forecast.firstNegativeDate !== null ? (
              <Badge tone="danger">Projected negative on {forecast.firstNegativeDate}</Badge>
            ) : (
              <Badge tone="success">Stays positive</Badge>
            )}
          </>
        );
      })}
    </Panel>
  );
}

function NetWorthPanel({ state }: { state: Loadable<NetWorthSnapshot | null> }) {
  const link =
    state.status === "ready" && state.data !== null
      ? { to: "/insights/networth", label: "Net worth over time" }
      : undefined;
  return (
    <Panel title="Net worth" link={link}>
      {renderState(state, (nw) => {
        if (nw === null) {
          return (
            <EmptyState title="Track your net worth">
              Add an account to total your assets and liabilities.
            </EmptyState>
          );
        }
        return (
          <Figures
            items={[
              { term: "Assets", value: formatCents(nw.assetsCents) },
              {
                term: "Liabilities",
                value: formatCents(nw.liabilitiesCents),
                negative: nw.liabilitiesCents < 0,
              },
              { term: "Net worth", value: formatCents(nw.netCents), negative: nw.netCents < 0 },
            ]}
          />
        );
      })}
    </Panel>
  );
}
