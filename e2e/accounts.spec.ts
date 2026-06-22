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
  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  await expect(page.getByRole("heading", { name: ACCOUNT, level: 1 })).toBeVisible();
  await expect(page.getByText("Balance: $0.00", { exact: true })).toBeVisible();
});

test("archive and unarchive an account (R7)", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Archive ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);

  await page.getByRole("button", { name: `Archive ${ACCOUNT}` }).click();
  await expect(page.getByRole("button", { name: ACCOUNT, exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Show archived" }).click();
  await expect(page.getByRole("heading", { name: "Archived accounts" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Unarchive ${ACCOUNT}` })).toBeVisible();

  await page.getByRole("button", { name: `Unarchive ${ACCOUNT}` }).click();
  await expect(page.getByRole("button", { name: ACCOUNT, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Unarchive ${ACCOUNT}` })).toHaveCount(0);
});

test("rename an account inline (R1)", async ({ page }) => {
  const stamp = Date.now();
  const ORIGINAL = `E2E Rename ${stamp}`;
  const RENAMED = `E2E Renamed ${stamp}`;
  await page.goto("/");
  await createAccount(page, ORIGINAL);
  await page.getByRole("button", { name: `Rename ${ORIGINAL}` }).click();
  await page.getByRole("textbox", { name: `Rename ${ORIGINAL}` }).fill(RENAMED);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: RENAMED, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Rename ${RENAMED}` })).toBeVisible();
});
