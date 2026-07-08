import { type ReactElement } from "react";
import { Navigate, NavLink, useNavigate, useParams } from "react-router";
import { type Api } from "./api";
import { AnalysisView } from "./AnalysisView";
import { SpendingBreakdownView } from "./SpendingBreakdownView";
import { SpendingTrendsView } from "./SpendingTrendsView";
import { BudgetVsActualView } from "./BudgetVsActualView";
import { BudgetBurndownView } from "./BudgetBurndownView";
import { ForecastView } from "./ForecastView";
import { CreditView } from "./CreditView";
import { PayoffView } from "./PayoffView";
import { NetWorthView } from "./NetWorthView";
import { ErrorBoundary } from "./ErrorBoundary";
import styles from "./Insights.module.css";

/**
 * UX3 — the Insights area, now URL-addressable at `/insights/:view` (ADR-0006). Each analysis view
 * (spend-by-envelope, spending breakdown, budget vs. actual, cash-flow forecast, credit utilization,
 * debt payoff, net worth) is its own deep-linkable route; the sub-nav is `<NavLink>`s (which set
 * `aria-current="page"` on the active one) instead of the old in-component tab state. The active
 * view stays a self-contained full page with its own <h1> and data fetch, and only it is mounted.
 *
 * Each view keeps its own <h1>. UX8 completed the Analysis → Insights migration: the headings now read
 * "Insights — …" and each view renders a hand-rolled accessible chart (ADR-0007) above its data table.
 * UX9 adds the "breakdown" view — a new share-of-outflow composition next to Spend. UX10 adds
 * "trends" — a new month-over-month outflow trend (total + top envelopes) next to Breakdown. UX11
 * adds "burndown" — within-month pace vs. target — next to Budget (its before-month-end companion).
 */
const TABS = [
  { id: "spend", label: "Spend" },
  { id: "breakdown", label: "Breakdown" },
  { id: "trends", label: "Trends" },
  { id: "budget", label: "Budget" },
  { id: "burndown", label: "Burn-down" },
  { id: "forecast", label: "Forecast" },
  { id: "credit", label: "Credit" },
  { id: "payoff", label: "Payoff" },
  { id: "networth", label: "Net worth" },
] as const;

type AnalysisTab = (typeof TABS)[number]["id"];

function renderView(view: AnalysisTab, api: Api): ReactElement {
  switch (view) {
    case "spend":
      return <AnalysisView api={api} />;
    case "breakdown":
      return <SpendingBreakdownView api={api} />;
    case "trends":
      return <SpendingTrendsView api={api} />;
    case "budget":
      return <BudgetVsActualView api={api} />;
    case "burndown":
      return <BudgetBurndownView api={api} />;
    case "forecast":
      return <ForecastView api={api} />;
    case "credit":
      return <CreditView api={api} />;
    case "payoff":
      return <PayoffView api={api} />;
    case "networth":
      return <NetWorthView api={api} />;
  }
}

export function AnalysisSection({ api }: { api: Api }) {
  const { view } = useParams();
  const navigate = useNavigate();
  const active = TABS.find((t) => t.id === view)?.id;

  // An unknown view (e.g. a stale or hand-typed URL) falls back to the default view.
  if (active === undefined) return <Navigate to="/insights/spend" replace />;

  return (
    <>
      <nav aria-label="Insights views" className={styles.subnav}>
        {TABS.map((t) => (
          <NavLink key={t.id} to={`/insights/${t.id}`} end>
            {t.label}
          </NavLink>
        ))}
      </nav>
      {/* R12 — a per-view boundary so a render crash in one view shows a recoverable fallback while
          the sub-nav stays usable. `key` is the active view, so switching mounts a fresh boundary;
          recovery exits to the home/dashboard. */}
      <ErrorBoundary key={active} resetLabel="← Dashboard" onReset={() => void navigate("/")}>
        {renderView(active, api)}
      </ErrorBoundary>
    </>
  );
}
