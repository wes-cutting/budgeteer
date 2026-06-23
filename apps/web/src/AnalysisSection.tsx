import { useState } from "react";
import { type Api } from "./api";
import { AnalysisView } from "./AnalysisView";
import { BudgetVsActualView } from "./BudgetVsActualView";
import { ForecastView } from "./ForecastView";
import { CreditView } from "./CreditView";
import { PayoffView } from "./PayoffView";
import { NetWorthView } from "./NetWorthView";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * R3 — unified Analysis section. Groups the six analysis views (spend-by-envelope, budget vs.
 * actual, cash-flow forecast, credit utilization, debt payoff, net worth) behind a single
 * Dashboard "Analysis" entry with an in-section sub-nav, so you can switch between them WITHOUT
 * returning to the Dashboard — replacing the long flat row of header buttons.
 *
 * Each view stays a self-contained full page (its own <h1> and its own data fetch). Only the
 * ACTIVE view is mounted, so switching tabs unmounts the previous view and mounts the next —
 * each view's useEffect fetch runs exactly when its tab is shown (no eager fetch-all-six). The
 * view's own "← Dashboard" button remains the section exit (onBack); the sub-nav only switches
 * views.
 *
 * The sub-nav is a <nav> of plain buttons with aria-current="page" on the active one — the
 * semantically-correct-buttons option (native Tab order; no roving tabindex / arrow keys, which
 * belong to the role="tablist" pattern). No transition is added on switch, so there is nothing
 * for prefers-reduced-motion to gate.
 */
const TABS = [
  { id: "spend", label: "Spend" },
  { id: "budget", label: "Budget" },
  { id: "forecast", label: "Forecast" },
  { id: "credit", label: "Credit" },
  { id: "payoff", label: "Payoff" },
  { id: "networth", label: "Net worth" },
] as const;

type AnalysisTab = (typeof TABS)[number]["id"];

export function AnalysisSection({ api, onBack }: { api: Api; onBack: () => void }) {
  const [tab, setTab] = useState<AnalysisTab>("spend");

  return (
    <>
      <nav aria-label="Analysis views">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {/* R12 — a per-view boundary so a render crash in one analysis view shows a recoverable
          fallback while the sub-nav above stays usable, instead of blanking the whole app. `key`
          is the active tab, so switching tabs mounts a fresh, error-free boundary; the fallback's
          recovery action is the section exit (← Dashboard). */}
      <ErrorBoundary key={tab} resetLabel="← Dashboard" onReset={onBack}>
        {tab === "spend" ? <AnalysisView api={api} onBack={onBack} /> : null}
        {tab === "budget" ? <BudgetVsActualView api={api} onBack={onBack} /> : null}
        {tab === "forecast" ? <ForecastView api={api} onBack={onBack} /> : null}
        {tab === "credit" ? <CreditView api={api} onBack={onBack} /> : null}
        {tab === "payoff" ? <PayoffView api={api} onBack={onBack} /> : null}
        {tab === "networth" ? <NetWorthView api={api} onBack={onBack} /> : null}
      </ErrorBoundary>
    </>
  );
}
