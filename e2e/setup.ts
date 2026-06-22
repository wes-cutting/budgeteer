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

// R3 — the analysis views are grouped under a single Dashboard "Analysis" entry with an
// in-section sub-nav. From the Dashboard, open the section and switch to the named tab.
export async function openAnalysis(page: Page, tab: string) {
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await page.getByRole("button", { name: tab, exact: true }).click();
}

export async function goToDashboard(page: Page) {
  const btn = page.getByRole("button", { name: "← Dashboard" });
  if (await btn.isVisible()) await btn.click();
  await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
}
