import { useState } from "react";
import { type AccountView, type Api, type EnvelopeView } from "./api";
import { Dashboard } from "./Dashboard";
import { AccountRegister } from "./AccountRegister";
import { EnvelopeLedger } from "./EnvelopeLedger";
import { NeedsAllocation } from "./NeedsAllocation";
import { TemplatesView } from "./TemplatesView";
import { RecurringView } from "./RecurringView";
import { AnalysisSection } from "./AnalysisSection";

type View =
  | { name: "dashboard" }
  | { name: "account"; accountId: string; accountName: string }
  | { name: "envelope"; envelope: EnvelopeView }
  | { name: "needs" }
  | { name: "templates" }
  | { name: "recurring" }
  | { name: "analysis" };

export function App({ api }: { api: Api }) {
  const [view, setView] = useState<View>({ name: "dashboard" });

  if (view.name === "account") {
    return (
      <AccountRegister
        api={api}
        accountId={view.accountId}
        accountName={view.accountName}
        onBack={() => setView({ name: "dashboard" })}
        onOpenNeeds={() => setView({ name: "needs" })}
      />
    );
  }
  if (view.name === "envelope") {
    return (
      <EnvelopeLedger
        api={api}
        envelope={view.envelope}
        onBack={() => setView({ name: "dashboard" })}
      />
    );
  }
  if (view.name === "needs") {
    return <NeedsAllocation api={api} onBack={() => setView({ name: "dashboard" })} />;
  }
  if (view.name === "templates") {
    return <TemplatesView api={api} onBack={() => setView({ name: "dashboard" })} />;
  }
  if (view.name === "recurring") {
    return <RecurringView api={api} onBack={() => setView({ name: "dashboard" })} />;
  }
  if (view.name === "analysis") {
    return <AnalysisSection api={api} onBack={() => setView({ name: "dashboard" })} />;
  }
  return (
    <Dashboard
      api={api}
      onOpenAccount={(a: AccountView) =>
        setView({ name: "account", accountId: a.id, accountName: a.name })
      }
      onOpenEnvelope={(e: EnvelopeView) => setView({ name: "envelope", envelope: e })}
      onOpenNeeds={() => setView({ name: "needs" })}
      onOpenTemplates={() => setView({ name: "templates" })}
      onOpenRecurring={() => setView({ name: "recurring" })}
      onOpenAnalysis={() => setView({ name: "analysis" })}
    />
  );
}
