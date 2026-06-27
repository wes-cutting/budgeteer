// Lead-stack Account Register: React Router (routing) + tokens/CSS-Modules (styling) +
// React Aria Dialog (a11y primitive). Self-contained data; representative of the real screen.
import { Link, useParams } from "react-router";
import { accountById, formatCents, TXNS, type Txn } from "../data";
import { AllocationDialog } from "./AllocationDialog";
import styles from "./register.module.css";

function amountClass(c: number): string {
  return c < 0 ? styles.neg : styles.pos;
}

function StatusCell({ txn }: { txn: Txn }) {
  if (txn.unallocatedCents === 0) return <span className={styles.status}>fully allocated</span>;
  return (
    <span className={`${styles.status} ${styles.needs}`}>
      needs {formatCents(Math.abs(txn.unallocatedCents))}
    </span>
  );
}

export function AccountRegister() {
  const { id } = useParams();
  const account = accountById(id);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.h1}>{account.name}</h1>
        <p className={styles.balance}>Balance: {formatCents(account.balanceCents)}</p>
        <span className={styles.spacer} />
        <Link className={styles.navlink} to="/">
          ← Accounts
        </Link>
        <Link className={styles.navlink} to="/needs-allocation">
          Needs allocation
        </Link>
      </header>

      <section aria-labelledby="register-heading">
        <h2 id="register-heading">Transactions</h2>

        <form className={styles.filterForm} aria-label="Filter transactions" onSubmit={(e) => e.preventDefault()}>
          <span className={styles.field}>
            <label className={styles.label} htmlFor="from">
              From date
            </label>
            <input className={styles.input} id="from" type="date" defaultValue="2026-06-01" />
          </span>
          <span className={styles.field}>
            <label className={styles.label} htmlFor="to">
              To date
            </label>
            <input className={styles.input} id="to" type="date" defaultValue="2026-06-30" />
          </span>
          <span className={styles.field}>
            <label className={styles.label} htmlFor="search">
              Search payee or memo
            </label>
            <input className={styles.input} id="search" type="search" placeholder="Search…" />
          </span>
        </form>

        <table className={styles.table}>
          <caption className={styles.label}>Transactions for {account.name}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Payee</th>
              <th scope="col">Amount</th>
              <th scope="col">Allocation</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {TXNS.map((t) => (
              <tr key={t.id}>
                <td>{t.occurredOn}</td>
                <td>{t.payee}</td>
                <td className={`${styles.amount} ${amountClass(t.amountCents)}`}>
                  {formatCents(t.amountCents)}
                </td>
                <td>
                  <StatusCell txn={t} />
                </td>
                <td>
                  <div className={styles.actions}>
                    <AllocationDialog txn={t} />
                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} aria-label={`Delete ${t.payee} transaction`}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
