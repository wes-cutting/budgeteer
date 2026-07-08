import { createBrowserRouter, Navigate, useParams } from "react-router";
import { useApi } from "./api-context";
import { AppShell } from "./AppShell";
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
        { index: true, element: <HomeRoute />, handle: { title: "Home" } },
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
        { path: "insights/:view", element: <InsightsRoute />, handle: { title: "Insights" } },
        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ]);
}
