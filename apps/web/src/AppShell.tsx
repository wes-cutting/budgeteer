import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { exportUrl } from "./api";
import { useApi } from "./api-context";
import styles from "./AppShell.module.css";

/**
 * UX3 — the persistent app shell (ADR-0006). A banner (brand + primary nav) that stays mounted
 * across route changes, plus the route `<Outlet>`. Retires the per-screen "← Dashboard" buttons:
 * navigation now lives here and works with the URL (back/forward, refresh, deep links).
 *
 * The needs-allocation count badge (R2) moves here from the Dashboard — it belongs in the
 * always-visible nav. The shell does not remount on navigation, so the count is refetched on each
 * path change (cheap, single request) to stay fresh after an allocation is completed; the fetch is
 * auxiliary, so a failure leaves the badge absent rather than breaking the chrome.
 */
export function AppShell() {
  const api = useApi();
  const location = useLocation();
  const [needsCount, setNeedsCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listNeedsAllocation()
      .then((txns) => {
        if (active) setNeedsCount(txns.length);
      })
      .catch(() => {
        /* badge is auxiliary — leave it absent on error */
      });
    return () => {
      active = false;
    };
  }, [api, location.pathname]);

  const hasNeeds = needsCount !== null && needsCount > 0;

  return (
    <>
      <header className={styles.banner}>
        <Link to="/" className={styles.brand}>
          Budgeteer
        </Link>
        <nav aria-label="Primary" className={styles.nav}>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink
            to="/needs-allocation"
            aria-label={hasNeeds ? `Needs allocation (${needsCount})` : undefined}
          >
            Needs allocation
            {hasNeeds ? (
              <span className={styles.badge} aria-hidden="true">
                {needsCount}
              </span>
            ) : null}
          </NavLink>
          <NavLink to="/templates">Templates</NavLink>
          <NavLink to="/recurring">Recurring</NavLink>
          <NavLink to="/insights">Insights</NavLink>
          <a href={exportUrl}>Download backup</a>
        </nav>
      </header>
      {/* Keyed by pathname so each route mounts fresh (data re-fetches on navigation, as the old
          view machine did by remounting) and the reduced-motion-gated fade replays on change. */}
      <div key={location.pathname} className={styles.content}>
        <Outlet />
      </div>
    </>
  );
}
