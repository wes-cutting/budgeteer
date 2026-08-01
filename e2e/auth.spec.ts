import { test, expect } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";

// BUD-S87 — browser-level auth (ADR-0009). The rest of the suite runs authenticated via
// global-setup's SHARED storageState session; these specs must NOT use it — signing out revokes the
// session server-side, which would break every spec that runs after this file (the suite is
// serial). So both tests start from an EMPTY session and the sign-out test mints its own via a real
// UI sign-in.
test.use({ storageState: { cookies: [], origins: [] } });

test("sign in, then sign out returns to the sign-in page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(E2E_ADMIN.username);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Signed in — the shell renders the Dashboard.
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to Budgeteer" })).toBeVisible();
});

test("visiting the app without a session redirects to the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to Budgeteer" })).toBeVisible();
});
