import { useState } from "react";
import { type AccountView, type Api } from "./api";
import { Dashboard } from "./Dashboard";
import { AccountRegister } from "./AccountRegister";
import { NeedsAllocation } from "./NeedsAllocation";
import { TemplatesView } from "./TemplatesView";
import { RecurringView } from "./RecurringView";

type View =
  | { name: "dashboard" }
  | { name: "account"; accountId: string; accountName: string }
  | { name: "needs" }
  | { name: "templates" }
  | { name: "recurring" };

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
  if (view.name === "needs") {
    return <NeedsAllocation api={api} onBack={() => setView({ name: "dashboard" })} />;
  }
  if (view.name === "templates") {
    return <TemplatesView api={api} onBack={() => setView({ name: "dashboard" })} />;
  }
  if (view.name === "recurring") {
    return <RecurringView api={api} onBack={() => setView({ name: "dashboard" })} />;
  }
  return (
    <Dashboard
      api={api}
      onOpenAccount={(a: AccountView) =>
        setView({ name: "account", accountId: a.id, accountName: a.name })
      }
      onOpenNeeds={() => setView({ name: "needs" })}
      onOpenTemplates={() => setView({ name: "templates" })}
      onOpenRecurring={() => setView({ name: "recurring" })}
    />
  );
}
