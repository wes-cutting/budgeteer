import { type Page, expect } from "@playwright/test";

export async function createAccount(
  page: Page,
  name: string,
  options: { kind?: string; balance?: string } = {},
) {
  const { kind = "checking", balance = "0.00" } = options;
  const form = page.getByRole("form", { name: "Add account" });
  await form.getByLabel("Name", { exact: true }).fill(name);
  if (kind !== "checking") {
    await form.getByLabel("Kind").selectOption(kind);
  }
  await form.getByLabel("Starting balance").fill(balance);
  await form.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

export async function createEnvelope(page: Page, name: string) {
  const form = page.getByRole("form", { name: "Add envelope" });
  await form.getByLabel("Name", { exact: true }).fill(name);
  await form.getByRole("button", { name: "Add envelope" }).click();
  await expect(page.getByRole("list", { name: "Envelopes list" }).getByText(name)).toBeVisible();
}

// UX3 — navigation now runs through the persistent app-shell nav (React Router links in the
// banner), not per-screen buttons. These helpers click those shell links.

export async function goToDashboard(page: Page) {
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
}

export async function openNeeds(page: Page) {
  // The link's accessible name gains a "(N)" count when items are pending — match the prefix.
  await page.getByRole("link", { name: /^Needs allocation/ }).click();
}

export async function openTemplates(page: Page) {
  await page.getByRole("link", { name: "Templates" }).click();
}

export async function openRecurring(page: Page) {
  // `exact` so this matches the shell nav's "Recurring" and not the cockpit's "Manage recurring".
  await page.getByRole("link", { name: "Recurring", exact: true }).click();
}

// The Insights area is URL-addressable at /insights/:view; open it via the shell, then the sub-nav.
export async function openAnalysis(page: Page, tab: string) {
  await page.getByRole("link", { name: "Insights" }).click();
  await page.getByRole("link", { name: tab, exact: true }).click();
}
