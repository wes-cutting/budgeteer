// Axis A, option 1 — React Router (data router). Real URLs, nested layout, back/forward, deep links.
import { createBrowserRouter, Link, Outlet, RouterProvider } from "react-router";
import { ACCOUNTS, formatCents, TXNS } from "../data";
import { AccountRegister } from "./AccountRegister";
import { AllocationDialog } from "./AllocationDialog";
import { AllocationDialogRadix } from "../radix/AllocationDialogRadix";
import styles from "./register.module.css";

// Dialog demos rendered OPEN (defaultOpen) so the axe scan can inspect dialog content without a click.
function DialogDemo({ lib }: { lib: "aria" | "radix" }) {
  return (
    <main className={styles.main}>
      <h1 className={styles.h1}>{lib === "aria" ? "React Aria" : "Radix"} dialog</h1>
      {lib === "aria" ? (
        <AllocationDialog txn={TXNS[2]} defaultOpen />
      ) : (
        <AllocationDialogRadix txn={TXNS[2]} defaultOpen />
      )}
    </main>
  );
}

function Shell() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.h1}>Accounts</h1>
      <ul aria-label="Accounts">
        {ACCOUNTS.map((a) => (
          <li key={a.id}>
            <Link className={styles.navlink} to={`/accounts/${a.id}`}>
              {a.name}
            </Link>{" "}
            — {formatCents(a.balanceCents)}
          </li>
        ))}
      </ul>
    </main>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      { path: "accounts/:id", element: <AccountRegister /> },
      { path: "needs-allocation", element: <Home /> },
      { path: "aria-demo", element: <DialogDemo lib="aria" /> },
      { path: "radix-demo", element: <DialogDemo lib="radix" /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
