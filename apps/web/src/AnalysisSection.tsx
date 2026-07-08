import { type ReactElement } from "react";
import { Link, Navigate, NavLink, useNavigate, useParams } from "react-router";
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
 * FEAT-UXR2 promoted the S7 "pay-periods" tab out of Insights to its own first-class `/pay-periods`
 * planner route, so it no longer appears here.
 *
 * FEAT-UXR6 (Insights IA) — the flat nine-link row becomes a two-row category IA: a primary row of
 * five CATEGORY links (Spending · Budget · Cash flow · Debt · Net worth) and, when the active category
 * has more than one view, a secondary segmented row of that category's sub-views. Both rows are still
 * `<nav>`s of links (not ARIA tabs) — these are real routes, so back/forward, deep links, and refresh
 * must keep working (the ADR-0006/UX3 stance). Every `/insights/:view` URL is preserved; the active
 * category and segment derive from the URL. Two labels read better under their category: `spend` shows
 * as "By envelope", `budget` as "vs Actual" (routes and the views' own <h2> headings are untouched).
 */
type SubView = { id: string; label: string };
type Category = { id: string; label: string; views: readonly SubView[] };

const CATEGORIES = [
  {
    id: "spending",
    label: "Spending",
    views: [
      { id: "spend", label: "By envelope" },
      { id: "breakdown", label: "Breakdown" },
      { id: "trends", label: "Trends" },
    ],
  },
  {
    id: "budget",
    label: "Budget",
    views: [
      { id: "budget", label: "vs Actual" },
      { id: "burndown", label: "Burn-down" },
    ],
  },
  { id: "cashflow", label: "Cash flow", views: [{ id: "forecast", label: "Forecast" }] },
  {
    id: "debt",
    label: "Debt",
    views: [
      { id: "credit", label: "Credit" },
      { id: "payoff", label: "Payoff" },
    ],
  },
  { id: "networth", label: "Net worth", views: [{ id: "networth", label: "Net worth" }] },
] as const satisfies readonly Category[];

type AnalysisTab = (typeof CATEGORIES)[number]["views"][number]["id"];

/** The category owning a given view (the primary row marks it active for every view it contains). */
function categoryOf(view: string): Category | undefined {
  return CATEGORIES.find((c) => c.views.some((v) => v.id === view));
}

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
  const category = view === undefined ? undefined : categoryOf(view);

  // An unknown view (e.g. a stale or hand-typed URL) falls back to the default view.
  if (category === undefined) return <Navigate to="/insights/spend" replace />;

  const active = view as AnalysisTab;

  return (
    <>
      {/* Primary row: the five categories. A category link targets its default sub-view; it is marked
          current for ANY view within the category (so its href may point at the default while a
          non-default sibling is showing — standard for sectioned nav), hence a plain <Link> with a
          computed aria-current rather than NavLink's exact-URL match. */}
      <nav aria-label="Insights categories" className={styles.categoryNav}>
        {CATEGORIES.map((c) => {
          const isActive = c.id === category.id;
          return (
            <Link
              key={c.id}
              to={`/insights/${c.views[0].id}`}
              className={isActive ? styles.categoryActive : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              {c.label}
            </Link>
          );
        })}
      </nav>
      {/* Secondary row: the active category's sub-views, only when it has more than one. These map
          one-to-one to a URL, so NavLink's exact (`end`) active match is exactly right here. */}
      {category.views.length > 1 ? (
        <nav aria-label={`${category.label} views`} className={styles.segmentNav}>
          {category.views.map((v) => (
            <NavLink key={v.id} to={`/insights/${v.id}`} end>
              {v.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
      {/* R12 — a per-view boundary so a render crash in one view shows a recoverable fallback while
          the nav stays usable. `key` is the active view, so switching mounts a fresh boundary;
          recovery exits to the home/dashboard. */}
      <ErrorBoundary key={active} resetLabel="← Dashboard" onReset={() => void navigate("/")}>
        {renderView(active, api)}
      </ErrorBoundary>
    </>
  );
}
