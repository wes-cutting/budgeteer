import { createBrowserRouter, Navigate, useNavigate, useParams } from "react-router";
import { useApi } from "./api-context";
import { AppShell } from "./AppShell";
import { Dashboard } from "./Dashboard";
import { AccountRegister } from "./AccountRegister";
import { EnvelopeLedgerRoute } from "./EnvelopeLedgerRoute";
import { NeedsAllocation } from "./NeedsAllocation";
import { TemplatesView } from "./TemplatesView";
import { RecurringView } from "./RecurringView";
import { AnalysisSection } from "./AnalysisSection";

/**
 * UX3 — the route map (ADR-0006), replacing the hand-rolled `view` state machine. The route
 * elements below are thin adapters: they read `api` from context and the URL params from the
 * router, then render the unchanged view components (which still take `api` as a prop so their
 * unit tests render them directly). Account/envelope list items navigate programmatically via
 * the Dashboard's existing `onOpen*` callbacks — the demoted `/accounts` · `/envelopes` list
 * routes and `/manage` land with UX6.
 */
function HomeRoute() {
  const api = useApi();
  const navigate = useNavigate();
  return (
    <Dashboard
      api={api}
      onOpenAccount={(a) => void navigate(`/accounts/${a.id}`)}
      onOpenEnvelope={(e) => void navigate(`/envelopes/${e.id}`)}
    />
  );
}

function AccountRoute() {
  const { id } = useParams();
  return <AccountRegister api={useApi()} accountId={id ?? ""} />;
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
        { path: "accounts/:id", element: <AccountRoute /> },
        { path: "envelopes/:id", element: <EnvelopeRoute /> },
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
