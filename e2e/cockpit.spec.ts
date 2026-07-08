import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope, goToDashboard, openAnalysis, openRecurring } from "./setup";

/** Parse a formatted money string ("$1,200.00" / "-$300.00") to integer cents. */
function parseCents(text: string): number {
  const negative = text.trim().startsWith("-");
  const digits = text.replace(/[^0-9.]/g, "");
  return Math.round(Number(digits) * 100) * (negative ? -1 : 1);
}

test("the home cockpit shows the Overview panels and reconciles net worth (UX5)", async ({
  page,
}) => {
  const stamp = Date.now();
  await page.goto("/");
  await createAccount(page, `E2E Cockpit ${stamp}`, { balance: "1000.00" });

  // createAccount lands on /accounts (UX6) — return to the cockpit home to read the Overview.
  await goToDashboard(page);
  const overview = page.getByRole("region", { name: "Overview" });
  await expect(overview).toBeVisible();
  for (const title of [
    "This month's budget",
    "Needs allocation",
    "Upcoming",
    "Cash-flow forecast",
    "Net worth",
  ]) {
    await expect(overview.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  }

  // The net-worth panel's figures reconcile against the real ledger: net = assets + liabilities
  // (kind-based, the R4/R9 convention). Robust to the shared DB — the invariant holds regardless.
  const nwPanel = overview
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Net worth", level: 3 }) });
  const figures = (await nwPanel.locator("dd").allTextContents()).map(parseCents);
  expect(figures).toHaveLength(3);
  const [assets, liabilities, net] = [figures[0]!, figures[1]!, figures[2]!];
  expect(net).toBe(assets + liabilities);

  // A cash account exists now, so the forecast panel follows one (not the empty state).
  const forecastPanel = overview
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Cash-flow forecast", level: 3 }) });
  await expect(forecastPanel.getByText(/next \d+ days/)).toBeVisible();
});

test("cockpit panels deep-link to their detail routes (UX5)", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E CockpitNav ${stamp}`;
  const ENVELOPE = `E2E CockpitEnv ${stamp}`;

  await page.goto("/");
  await createAccount(page, ACCOUNT, { balance: "500.00" });
  await createEnvelope(page, ENVELOPE);
  // The creates navigate to /accounts · /envelopes (UX6) — return to the cockpit to use its links.
  await goToDashboard(page);

  // Forecast + net-worth links are present whenever a cash account exists.
  await page.getByRole("link", { name: "View forecast" }).click();
  await expect(
    page.getByRole("heading", { name: "Insights — cash-flow forecast", level: 2 }),
  ).toBeVisible();
  await goToDashboard(page);

  await page.getByRole("link", { name: "Net worth over time" }).click();
  await expect(
    page.getByRole("heading", { name: "Insights — net worth over time", level: 2 }),
  ).toBeVisible();
  await goToDashboard(page);

  // Set a monthly target → the budget panel gains its "Review budget" deep-link.
  await openAnalysis(page, "Budget");
  const targetForm = page.getByRole("form", { name: `Target for ${ENVELOPE}` });
  await targetForm.getByLabel(`Monthly target for ${ENVELOPE}`).fill("200.00");
  await targetForm.getByRole("button", { name: "Save" }).click();
  await expect(targetForm.getByRole("button", { name: "Clear" })).toBeVisible();
  await goToDashboard(page);
  await page.getByRole("link", { name: "Review budget" }).click();
  await expect(
    page.getByRole("heading", { name: "Insights — budget vs. actual", level: 2 }),
  ).toBeVisible();
  await goToDashboard(page);

  // Create a recurring rule → the upcoming panel gains its "Manage recurring" deep-link.
  await openRecurring(page);
  await expect(page.getByRole("heading", { name: "Recurring", level: 1 })).toBeVisible();
  await page.getByLabel("Account").selectOption({ label: ACCOUNT });
  await page.getByLabel("Amount").fill("100.00");
  await page.getByLabel("Payee").fill(`E2E Sub ${stamp}`);
  await page.getByLabel("Frequency").selectOption("monthly");
  await page.getByLabel("First date").fill("2020-01-01");
  await page.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE });
  await page.getByRole("button", { name: "Create recurring rule" }).click();
  await expect(
    page.getByRole("list", { name: "Recurring rules" }).getByText(ENVELOPE).first(),
  ).toBeVisible();
  await goToDashboard(page);

  // FEAT-S9: with a withdrawal rule in place, the panel derives "Still owed this month" — a
  // parseable non-negative money figure (exact sums are unit-tested; the e2e DB is shared).
  const upcoming = page
    .getByRole("region", { name: "Overview" })
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Upcoming", level: 3 }) });
  await expect(upcoming.getByText("Still owed this month")).toBeVisible();
  expect(parseCents(await upcoming.locator("dd").first().innerText())).toBeGreaterThanOrEqual(0);

  await page.getByRole("link", { name: "Manage recurring" }).click();
  await expect(page.getByRole("heading", { name: "Recurring", level: 1 })).toBeVisible();
  await goToDashboard(page);
});
