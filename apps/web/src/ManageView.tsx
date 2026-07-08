import { useEffect, useState } from "react";
import { Link } from "react-router";
import { isLiabilityKind } from "@budgeteer/domain";
import { type AccountView, type Api, type EnvelopeView } from "./api";
import { formatCents } from "./format";
import { MoveMoneyForm } from "./MoveMoneyForm";
import { Skeleton, useToast } from "./ui";

const NUM: React.CSSProperties = { textAlign: "right" };

/**
 * UX6 — the `/manage` hub. Demoted off the home alongside the list routes, it owns the
 * CROSS-ENTITY management tools — the household net-worth summary (spans every account) and
 * Move-money (re-budgets between two envelopes) — and points to the per-entity `/accounts` ·
 * `/envelopes` pages where create/rename/archive live. Fan-out over the existing reads (no new
 * endpoint); remounts on navigation, so figures refresh on each visit.
 */
export function ManageView({ api }: { api: Api }) {
  const [accounts, setAccounts] = useState<AccountView[] | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    Promise.all([api.listAccounts(), api.listEnvelopes()])
      .then(([a, e]) => {
        if (!active) return;
        setAccounts(a);
        setEnvelopes(e);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Couldn't load your data.");
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function refreshEnvelopes() {
    try {
      setEnvelopes(await api.listEnvelopes());
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Couldn't refresh envelopes.");
    }
  }

  return (
    <main>
      {/* FEAT-UXR1 — the page title is the shell's single <h1> (top bar); this view drops its own. */}
      {loadError ? <p role="alert">{loadError}</p> : null}

      <p>
        Add, rename, or archive your accounts and envelopes; check your net worth; and move budgeted
        money between envelopes.
      </p>
      {/* Each link stands alone in its <li> (no surrounding prose) so it is not a "link in a text
          block" — the axe WCAG 1.4.1 rule that needs links distinguished by more than colour. */}
      <nav aria-label="Management">
        <ul>
          <li>
            <Link to="/accounts">Accounts</Link>
          </li>
          <li>
            <Link to="/envelopes">Envelopes</Link>
          </li>
        </ul>
      </nav>

      <section aria-labelledby="networth-heading">
        <h2 id="networth-heading">Net worth</h2>
        <NetWorthSummary accounts={accounts} />
      </section>

      <section aria-labelledby="movemoney-heading">
        <h2 id="movemoney-heading">Move money</h2>
        <MoveMoneyForm
          api={api}
          envelopes={envelopes ?? []}
          onMoved={() => {
            showToast("Money moved");
            void refreshEnvelopes();
          }}
        />
      </section>
    </main>
  );
}

/**
 * R4 — household net-worth snapshot (relocated from the home to `/manage`). A pure front-end Σ over
 * the account list, split by account KIND (not sign): liability kinds (credit/loan) carry their
 * debt negative, so they sum into Liabilities (≤ 0) and Net = Assets + Liabilities falls out. Sums
 * ALL accounts — active AND archived — to match the R9 endpoint, and uses the shared
 * `isLiabilityKind` so it agrees with the NetWorthView classification.
 */
function NetWorthSummary({ accounts }: { accounts: AccountView[] | null }) {
  if (accounts === null) return <Skeleton />;
  if (accounts.length === 0) {
    return <p>Add an account to total your assets and liabilities.</p>;
  }
  let assetsCents = 0;
  let liabilitiesCents = 0;
  for (const a of accounts) {
    if (isLiabilityKind(a.kind)) liabilitiesCents += a.balanceCents;
    else assetsCents += a.balanceCents;
  }
  const netCents = assetsCents + liabilitiesCents;
  return (
    <table>
      <caption>Net worth summary</caption>
      <tbody>
        <tr>
          <th scope="row">Total assets</th>
          <td style={NUM}>{formatCents(assetsCents)}</td>
        </tr>
        <tr>
          <th scope="row">Total liabilities</th>
          <td style={NUM}>{formatCents(liabilitiesCents)}</td>
        </tr>
        <tr>
          <th scope="row">Net worth</th>
          <td style={NUM}>{formatCents(netCents)}</td>
        </tr>
      </tbody>
    </table>
  );
}
