import { expect, test } from "@playwright/test";
import { createAccount } from "./setup";

test("dashboard loads against the real API", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
  // No error means initial GET /accounts + GET /envelopes both succeeded — the CORS-class check.
  // A CORS misconfig surfaces here exactly as the shipped bug did.
  await expect(page.getByText("Couldn't load your data.")).toHaveCount(0);
});

test("create a checking account and open its register", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await page.getByRole("button", { name: ACCOUNT }).click();
  await expect(page.getByRole("heading", { name: ACCOUNT, level: 1 })).toBeVisible();
  await expect(page.getByText("Balance: $0.00", { exact: true })).toBeVisible();
});
