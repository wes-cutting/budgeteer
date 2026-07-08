import { Link } from "react-router";
import { EmptyState } from "./ui";
import styles from "./FirstRunOnboarding.module.css";

/**
 * UX14 — first-run onboarding. The Home renders this ONLY when the app is completely empty — no
 * accounts AND no envelopes — a state DERIVED from the ledger reads, never a stored "has onboarded"
 * flag (derive-don't-store: add one account or envelope and it disappears, the cockpit takes over,
 * and its per-panel empty states guide the rest). It replaces the cockpit's five disconnected
 * per-panel empty states — a fragmented first impression — with one guided next step, tied to the
 * PRD's week-one success metric ("still keeping it current past week one").
 *
 * Pure presentation: composes the FEAT-UX4 `EmptyState`; the two steps are `<Link>`s to the
 * management surfaces that already own creation (`/accounts`, `/envelopes`). No new dependency.
 */
export function FirstRunOnboarding() {
  return (
    <section aria-label="Get started" className={styles.wrap}>
      <EmptyState title="Welcome to Budgeteer">
        <p className={styles.lead}>
          Two steps to start tracking where your money goes — then keep it current and it stays
          worth the switch past week one.
        </p>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepText}>
              <strong>Add your first account</strong> — the checking, savings, or card accounts you
              spend from.
            </span>
            <Link to="/accounts" className={styles.cta}>
              Add an account
            </Link>
          </li>
          <li>
            <span className={styles.stepText}>
              <strong>Set up your envelopes</strong> — the budget categories you divide your money
              into.
            </span>
            <Link to="/envelopes" className={styles.cta}>
              Add envelopes
            </Link>
          </li>
        </ol>
      </EmptyState>
    </section>
  );
}
