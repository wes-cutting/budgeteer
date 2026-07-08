import { expect, test } from "@playwright/test";
import { createAccount } from "./setup";

/**
 * UX3 — the routing/app-shell acceptance: every screen is URL-addressable, deep-linkable,
 * refresh-safe, and the browser back/forward buttons work. These were impossible under the old
 * hand-rolled `view` state machine (no URLs; a refresh dropped to the dashboard).
 *
 * UX6 — account names are now <Link>s on the `/accounts` list route, so these journeys open a
 * register from that list rather than from the home.
 */
test("navigating to an account updates the URL, and a refresh re-renders it (deep-link / refresh-safe)", async ({
  page,
}) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Route ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT); // lands on /accounts

  // Opening the account pushes a real URL.
  await page
    .getByRole("table", { name: "Accounts", exact: true })
    .getByRole("link", { name: ACCOUNT, exact: true })
    .click();
  await expect(page.getByRole("heading", { name: ACCOUNT, level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);

  // A hard refresh of that deep URL re-renders the same register (the name is re-derived from the
  // account list, not carried in nav state) — proof it is refresh-safe.
  await page.reload();
  await expect(page.getByRole("heading", { name: ACCOUNT, level: 1 })).toBeVisible();
});

test("browser back and forward move between the accounts list and a register", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Back ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT); // lands on /accounts (the list)

  await page
    .getByRole("table", { name: "Accounts", exact: true })
    .getByRole("link", { name: ACCOUNT, exact: true })
    .click();
  await expect(page.getByRole("heading", { name: ACCOUNT, level: 1 })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Accounts", level: 1 })).toBeVisible();

  await page.goForward();
  await expect(page.getByRole("heading", { name: ACCOUNT, level: 1 })).toBeVisible();
});

test("the Insights hub redirects to the default view; an unknown path redirects home", async ({
  page,
}) => {
  // /insights → /insights/spend (the index redirect).
  await page.goto("/insights");
  await expect(
    page.getByRole("heading", { name: "Insights — spend by envelope", level: 2 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/insights\/spend$/);

  // An unknown deep link falls back to the dashboard (the catch-all route).
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

// FEAT-UXR6 (Insights IA) — the non-negotiable: every legacy /insights/:view deep link still renders
// its own view, now with the correct CATEGORY tab marked current. This sweeps all nine so the IA
// restructure can't silently break a deep link, a bookmark, or a cockpit link.
const INSIGHTS_DEEP_LINKS = [
  { view: "spend", heading: "Insights — spend by envelope", category: "Spending" },
  { view: "breakdown", heading: "Insights — spending breakdown", category: "Spending" },
  { view: "trends", heading: "Insights — spending trends", category: "Spending" },
  { view: "budget", heading: "Insights — budget vs. actual", category: "Budget" },
  { view: "burndown", heading: "Insights — budget burn-down", category: "Budget" },
  { view: "forecast", heading: "Insights — cash-flow forecast", category: "Cash flow" },
  { view: "credit", heading: "Insights — credit utilization", category: "Debt" },
  { view: "payoff", heading: "Insights — debt payoff", category: "Debt" },
  { view: "networth", heading: "Insights — net worth over time", category: "Net worth" },
] as const;

for (const { view, heading, category } of INSIGHTS_DEEP_LINKS) {
  test(`Insights deep link /insights/${view} is preserved and marks the ${category} tab`, async ({
    page,
  }) => {
    await page.goto(`/insights/${view}`);
    await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/insights/${view}$`));
    const categories = page.getByRole("navigation", { name: "Insights categories" });
    await expect(categories.getByRole("link", { name: category, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
}
