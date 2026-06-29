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

export function createAppRouter() {
  return createBrowserRouter([
    {
      path: "/",
      element: <AppShell />,
      children: [
        { index: true, element: <HomeRoute /> },
        { path: "transactions/new", element: <QuickAddRoute /> },
        { path: "accounts", element: <AccountsListRoute /> },
        { path: "accounts/:id", element: <AccountRoute /> },
        { path: "envelopes", element: <EnvelopesListRoute /> },
        { path: "envelopes/:id", element: <EnvelopeRoute /> },
        { path: "manage", element: <ManageRoute /> },
        { path: "needs-allocation", element: <NeedsRoute /> },
        { path: "templates", element: <TemplatesRoute /> },
        { path: "recurring", element: <RecurringRoute /> },
        { path: "insights", element: <Navigate to="/insights/spend" replace /> },
        { path: "insights/:view", element: <InsightsRoute /> },
        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ]);
}
