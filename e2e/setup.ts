import { type Page, expect } from "@playwright/test";

// UX3 — navigation runs through the persistent app-shell nav (React Router links in the banner).
// UX6 — account/envelope management moved off the home: CRUD lives on the `/accounts` · `/envelopes`
// LIST routes (each name a <Link> to its detail), and the cross-cutting net-worth summary +
// Move-money live on `/manage`. These helpers drive those surfaces via the shell nav.

/** The persistent shell's primary nav — scoped so link names never clash with in-page links
 *  (e.g. the /manage hub also links to "Accounts"/"Envelopes"). */
function primaryNav(page: Page) {
  return page.getByRole("navigation", { name: "Primary" });
}

export async function goToDashboard(page: Page) {
  await primaryNav(page).getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
}

export async function goToAccounts(page: Page) {
  await primaryNav(page).getByRole("link", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Accounts", level: 1 })).toBeVisible();
}

export async function goToEnvelopes(page: Page) {
  await primaryNav(page).getByRole("link", { name: "Envelopes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Envelopes", level: 1 })).toBeVisible();
}

export async function goToManage(page: Page) {
  await primaryNav(page).getByRole("link", { name: "Manage", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Manage", level: 1 })).toBeVisible();
}

export async function createAccount(
  page: Page,
  name: string,
  options: { kind?: string; balance?: string } = {},
) {
  const { kind = "checking", balance = "0.00" } = options;
  await goToAccounts(page);
  // The add form is progressive (UX6) — reveal it via the "Add account" affordance if it is hidden.
  const form = page.getByRole("form", { name: "Add account" });
  if (!(await form.isVisible())) {
    await page.getByRole("button", { name: "Add account" }).click();
  }
  await form.getByLabel("Name", { exact: true }).fill(name);
  if (kind !== "checking") {
    await form.getByLabel("Kind").selectOption(kind);
  }
  await form.getByLabel("Starting balance").fill(balance);
  await form.getByRole("button", { name: "Add account" }).click();
  await expect(
    page.getByRole("list", { name: "Accounts list" }).getByRole("link", { name, exact: true }),
  ).toBeVisible();
}

export async function createEnvelope(page: Page, name: string) {
  await goToEnvelopes(page);
  const form = page.getByRole("form", { name: "Add envelope" });
  if (!(await form.isVisible())) {
    await page.getByRole("button", { name: "Add envelope" }).click();
  }
  await form.getByLabel("Name", { exact: true }).fill(name);
  await form.getByRole("button", { name: "Add envelope" }).click();
  await expect(
    page.getByRole("list", { name: "Envelopes list" }).getByRole("link", { name, exact: true }),
  ).toBeVisible();
}

/** Open an account's register by clicking its <Link> on the /accounts list (UX6 — was a button). */
export async function openAccount(page: Page, name: string) {
  await goToAccounts(page);
  await page
    .getByRole("list", { name: "Accounts list" })
    .getByRole("link", { name, exact: true })
    .click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

/** Open an envelope's ledger by clicking its <Link> on the /envelopes list (UX6 — was a button). */
export async function openEnvelope(page: Page, name: string) {
  await goToEnvelopes(page);
  await page
    .getByRole("list", { name: "Envelopes list" })
    .getByRole("link", { name, exact: true })
    .click();
  await expect(page.getByRole("heading", { name: new RegExp(name), level: 1 })).toBeVisible();
}

export async function openNeeds(page: Page) {
  // The link's accessible name gains a "(N)" count when items are pending — match the prefix.
  await page.getByRole("link", { name: /^Needs allocation/ }).click();
}

export async function openTemplates(page: Page) {
  await primaryNav(page).getByRole("link", { name: "Templates" }).click();
}

export async function openRecurring(page: Page) {
  // `exact` so this matches the shell nav's "Recurring" and not the cockpit's "Manage recurring".
  await primaryNav(page).getByRole("link", { name: "Recurring", exact: true }).click();
}

// The Insights area is URL-addressable at /insights/:view; open it via the shell, then the sub-nav.
export async function openAnalysis(page: Page, tab: string) {
  await primaryNav(page).getByRole("link", { name: "Insights" }).click();
  await page.getByRole("link", { name: tab, exact: true }).click();
}
