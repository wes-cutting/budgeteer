import { expect, test } from "@playwright/test";
import { createAccount } from "./setup";

const API = "http://localhost:3001";

test("Download backup link is visible on the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Download backup" })).toBeVisible();
});

test("GET /export returns a valid JSON backup with correct headers", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/");
  await createAccount(page, `Backup Account ${stamp}`);

  const response = await page.request.get(`${API}/export`);
  expect(response.status()).toBe(200);

  const disposition = response.headers()["content-disposition"] ?? "";
  expect(disposition).toMatch(/^attachment; filename="budgeteer-backup-\d{4}-\d{2}-\d{2}\.json"$/);

  const body = (await response.json()) as {
    version: number;
    exportedAt: string;
    tables: {
      accounts: unknown[];
      transactions: unknown[];
      households: unknown[];
    };
  };
  expect(body.version).toBe(1);
  expect(body.exportedAt).toBeTruthy();
  expect(Array.isArray(body.tables.accounts)).toBe(true);
  expect(body.tables.accounts.length).toBeGreaterThan(0);
  expect(Array.isArray(body.tables.transactions)).toBe(true);
  expect(Array.isArray(body.tables.households)).toBe(true);
});
