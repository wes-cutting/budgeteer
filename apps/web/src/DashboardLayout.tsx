import { NavLink, Outlet } from "react-router";
import styles from "./Insights.module.css";

/**
 * FEAT-UXR9 — the Dashboard shell. The home (`/`, the UX5 cockpit) and the pay-period planner
 * (`/pay-periods`, the FEAT-UXR2 side-by-side ledgers) become two sub-tabs of one Dashboard:
 * **Overview** and **Pay periods**. The standalone `/pay-periods` sidebar destination is retired —
 * pay-period planning is absorbed here — but each sub-tab keeps its OWN URL, so deep links, the
 * `/insights/pay-periods` redirect, and the cockpit's Next-paycheck link all keep working unchanged.
 *
 * A centered sub-tab nav switches between them (the same `categoryNav` treatment Insights uses and
 * PayPeriodsView already shares from `Insights.module.css`, now centered site-wide). The shell owns
 * the single `<h1>` ("Dashboard" for both sub-tabs, FEAT-UXR1); each sub-view renders its own `<h2>`s
 * below. NavLink's `end` keeps Overview from staying active on `/pay-periods`.
 */
export function DashboardLayout() {
  return (
    <>
      <nav aria-label="Dashboard views" className={styles.categoryNav}>
        <NavLink to="/" end>
          Overview
        </NavLink>
        <NavLink to="/pay-periods" end>
          Pay periods
        </NavLink>
      </nav>
      <Outlet />
    </>
  );
}
