import { useEffect, useState } from "react";
import { type Api } from "./api";
import { Cockpit } from "./Cockpit";
import { FirstRunOnboarding } from "./FirstRunOnboarding";
import { Skeleton } from "./ui";

/**
 * UX6 — the home (`/`) renders the UX5 cockpit; account/envelope management was demoted to the
 * `/accounts` · `/envelopes` list routes and the `/manage` hub.
 *
 * UX14 — first-run onboarding. Before deciding what to show, the home DERIVES whether the app is
 * completely empty (no accounts AND no envelopes) from the ledger reads — never a stored flag
 * (derive-don't-store). A truly blank app gets one guided next step (`FirstRunOnboarding`) instead
 * of the cockpit's five disconnected per-panel empty states; the moment anything exists the cockpit
 * takes over. On a read error we fall through to the cockpit (it surfaces its own per-panel states).
 *
 * FEAT-UXR1 — the page title is the shell's single `<h1>` (the top bar, "Home" for `/`); this view
 * drops its own. Keeps the single `<main>`; the child supplies its own region below it.
 */
export function Home({ api }: { api: Api }) {
  // null = still deciding; true = empty app → onboarding; false = has data → cockpit.
  const [firstRun, setFirstRun] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.listAccounts(), api.listEnvelopes()])
      .then(([accounts, envelopes]) => {
        if (active) setFirstRun(accounts.length === 0 && envelopes.length === 0);
      })
      .catch(() => {
        // A failed check must not gate the whole home — show the cockpit, which degrades per panel.
        if (active) setFirstRun(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <main>
      {firstRun === null ? (
        <Skeleton rows={3} />
      ) : firstRun ? (
        <FirstRunOnboarding />
      ) : (
        <Cockpit api={api} />
      )}
    </main>
  );
}
