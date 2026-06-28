import { type Api } from "./api";
import { Cockpit } from "./Cockpit";

/**
 * UX6 — the home (`/`) now renders the UX5 cockpit ONLY. Account/envelope management, the net-worth
 * summary, and Move-money were demoted to the `/accounts` · `/envelopes` list routes and the
 * `/manage` hub, so the landing page is purely the budget + future-planning overview.
 *
 * Keeps the single `<main>` + `<h1>Budgeteer</h1>` the axe suite (light AND dark) and the e2e nav
 * helpers depend on; the cockpit supplies its own `Overview` region and per-panel deep-links.
 */
export function Home({ api }: { api: Api }) {
  return (
    <main>
      <h1>Budgeteer</h1>
      <Cockpit api={api} />
    </main>
  );
}
