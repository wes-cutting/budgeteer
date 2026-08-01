import { test, expect } from "@playwright/test";

// BUD-S88 — admin user management in the browser. The suite runs as the admin (global-setup), so the
// Users entry is available. A unique username keeps it idempotent against the shared e2e store.
test("an admin adds a member, then disables them", async ({ page }) => {
  const username = `member-${Date.now()}`;
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Add member" }).click();
  const form = page.getByRole("form", { name: "Add member" });
  await form.getByLabel("Username").fill(username);
  await form.getByLabel("Password").fill("member-password-123");
  await form.getByRole("button", { name: "Add member" }).click();

  const row = page.getByRole("row", { name: new RegExp(username) });
  await expect(row).toBeVisible();
  await expect(row.getByText("Active")).toBeVisible();

  await page.getByRole("button", { name: `Disable ${username}` }).click();
  await expect(row.getByText("Disabled")).toBeVisible();
});
