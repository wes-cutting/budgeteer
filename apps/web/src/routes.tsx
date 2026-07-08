import { createBrowserRouter, Navigate, useParams } from "react-router";
import { useApi } from "./api-context";
import { AppShell } from "./AppShell";
import { DashboardLayout } from "./DashboardLayout";
import { Home } from "./Home";
import { AccountsList } from "./AccountsList";
import { EnvelopesList } from "./EnvelopesList";
import { ManageView } from "./ManageView";
import { AccountRegister } from "./AccountRegister";
import { QuickAddTransaction } from "./QuickAddTransaction";
import { EnvelopeLedgerRoute } from "./EnvelopeLedgerRoute";
import { NeedsAllocation } from "./NeedsAllocation";
import { TemplatesView } from "./TemplatesView";
import { RecurringView } from "./RecurringView";
import { AnalysisSection } from "./AnalysisSection";
import { PayPeriodsView } from "./PayPeriodsView";

/**
 * UX3 — the route map (ADR-0006), replacing the hand-rolled `view` state machine. The route
 * elements below are thin adapters: they read `api` from context and the URL params from the
 * router, then render the unchanged view components (which still take `api` as a prop so their
 * unit tests render them directly).
 *
 * UX6 — the home is now the cockpit ONLY; account/envelope management moved to the `/accounts` ·
 * `/envelopes` LIST routes (each name a `<Link>` to its detail) and the cross-cutting `/manage` hub.
 *
 * UX7 — `/transactions/new` is a MODAL route: a child of the shell that renders the global quick-add
 * dialog over (and returns you to) wherever you were, so the common "add a transaction" case is no
 * longer buried behind opening a register.
 *
 * FEAT-UXR9 — the home (`/`) and the pay-period planner (`/pay-periods`) are now two sub-tabs of a
 * single Dashboard, wrapped in a pathless `DashboardLayout` route that renders the shared sub-tab nav.
 * The standalone `/pay-periods` sidebar destination is retired (absorbed into the Dashboard), but its
 * URL is preserved as the sub-tab's own address, so deep links and the `/insights/pay-periods`
 * redirect are unchanged.
 */
function HomeRoute() {
  return <Home api={useApi()} />;
}

function AccountsListRoute() {
  return <AccountsList api={useApi()} />;
}

function EnvelopesListRoute() {
  return <EnvelopesList api={useApi()} />;
}

function ManageRoute() {
  return <ManageView api={useApi()} />;
}

function AccountRoute() {
  const { id } = useParams();
  return <AccountRegister api={useApi()} accountId={id ?? ""} />;
}

function QuickAddRoute() {
  return <QuickAddTransaction api={useApi()} />;
}

function EnvelopeRoute() {
  const { id } = useParams();
  return <EnvelopeLedgerRoute api={useApi()} envelopeId={id ?? ""} />;
}

function NeedsRoute() {
  return <NeedsAllocation api={useApi()} />;
}

function TemplatesRoute() {
  return <TemplatesView api={useApi()} />;
}

function RecurringRoute() {
  return <RecurringView api={useApi()} />;
}

function InsightsRoute() {
  return <AnalysisSection api={useApi()} />;
}

function PayPeriodsRoute() {
  return <PayPeriodsView api={useApi()} />;
}

/**
 * FEAT-UXR1 (Q3) — each static route carries a `handle: { title }` that the shell reads via
 * `useMatches()` and renders as the page's single `<h1>` in the top bar (and syncs `document.title`).
 * Dynamic routes (account register · envelope ledger) carry the kind-label fallback and publish
 * their resolved name at runtime through the shell's title context (`useSetPageTitle`). The
 * quick-add modal route has NO title handle — it never retitles the page (its `Dialog` names itself).
 */
export function createAppRouter() {
  return createBrowserRouter([
    {
      path: "/",
      element: <AppShell />,
      children: [
        // FEAT-UXR9 — Overview (`/`) + Pay periods (`/pay-periods`) as Dashboard sub-tabs. The
        // pathless layout renders the sub-tab nav once above whichever sub-view is active; both carry
        // the "Dashboard" title so the shell <h1> reads the same across the tabs.
        {
          element: <DashboardLayout />,
          children: [
            { index: true, element: <HomeRoute />, handle: { title: "Dashboard" } },
            {
              path: "pay-periods",
              element: <PayPeriodsRoute />,
              handle: { title: "Dashboard" },
            },
          ],
        },
        { path: "transactions/new", element: <QuickAddRoute /> },
        { path: "accounts", element: <AccountsListRoute />, handle: { title: "Accounts" } },
        { path: "accounts/:id", element: <AccountRoute />, handle: { title: "Account" } },
        { path: "envelopes", element: <EnvelopesListRoute />, handle: { title: "Envelopes" } },
        { path: "envelopes/:id", element: <EnvelopeRoute />, handle: { title: "Envelope" } },
        { path: "manage", element: <ManageRoute />, handle: { title: "Manage" } },
        {
          path: "needs-allocation",
          element: <NeedsRoute />,
          handle: { title: "Needs allocation" },
        },
        { path: "templates", element: <TemplatesRoute />, handle: { title: "Templates" } },
        { path: "recurring", element: <RecurringRoute />, handle: { title: "Recurring" } },
        { path: "insights", element: <Navigate to="/insights/spend" replace /> },
        // FEAT-UXR2 — the pay-period planner's old Insights deep-link redirects to `/pay-periods`
        // (now a Dashboard sub-tab, FEAT-UXR9); the URL is preserved so the redirect is unchanged.
        { path: "insights/pay-periods", element: <Navigate to="/pay-periods" replace /> },
        { path: "insights/:view", element: <InsightsRoute />, handle: { title: "Insights" } },
        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ]);
}
