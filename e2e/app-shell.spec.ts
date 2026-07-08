import { expect, test } from "@playwright/test";
import { goToAccounts, goToDashboard } from "./setup";

/**
 * FEAT-UXR1 — the sidebar app shell. Covers the chrome behaviours the shell adds over the old
 * top-banner nav: the desktop collapse-to-rail (persisted client-side), the ≤ 640px off-canvas
 * drawer (Radix Dialog — open / Esc / scrim / navigate-closes with focus restored), the compact
 * top-bar Add at narrow width, and the single-<h1>-per-page invariant. Nav-through-the-sidebar and
 * heading identity are covered by the re-pointed routing/a11y specs + setup helpers.
 */

const PHONE = { width: 375, height: 812 };

test.describe("app shell — desktop collapse-to-rail", () => {
  test("the toggle collapses the sidebar to a rail and the choice survives a reload", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    // Expanded by default: the labels are visible.
    await expect(nav.getByText("Accounts", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    // Rail: labels hidden, the toggle now offers to expand, accessible names intact.
    await expect(nav.getByText("Accounts", { exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Accounts" })).toBeVisible(); // name kept in the rail

    // Persisted client-side — a reload comes back in the rail.
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(nav.getByText("Accounts", { exact: true })).toBeHidden();

    // Toggling back expands it (and re-persists).
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(nav.getByText("Accounts", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  });
});

test.describe("app shell — narrow-width drawer (≤ 640px)", () => {
  test.use({ viewport: PHONE });

  test("the hamburger opens the drawer; Esc closes it and restores focus to the hamburger", async ({
    page,
  }) => {
    await page.goto("/");
    // The persistent sidebar is off-canvas at phone width; the hamburger carries the nav.
    const hamburger = page.getByRole("button", { name: "Open navigation" });
    await expect(hamburger).toBeVisible();

    await hamburger.click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Accounts" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    // Focus is restored to the trigger (Radix Dialog machinery).
    await expect(hamburger).toBeFocused();
  });

  test("a scrim click closes the drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();

    // Click the scrim well to the right of the ≤ 280px drawer.
    await page.mouse.click(360, 400);
    await expect(drawer).toBeHidden();
  });

  test("choosing an item navigates and closes the drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await drawer.getByRole("link", { name: "Accounts" }).click();

    await expect(drawer).toBeHidden();
    await expect(page.getByRole("heading", { name: "Accounts", level: 1 })).toBeVisible();
  });

  test("the compact top-bar Add opens the quick-add modal (the footer is off-canvas here)", async ({
    page,
  }) => {
    await page.goto("/");
    // At phone width the sidebar footer is off-canvas, so the top bar carries the compact + Add.
    await page.getByRole("link", { name: "Add transaction" }).click();
    await expect(page.getByRole("dialog", { name: "Add a transaction" })).toBeVisible();
  });
});

test.describe("app shell — heading integrity", () => {
  test("every route exposes exactly one <h1> (the shell top-bar title)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    await goToAccounts(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    // An Insights view keeps "Insights" as the shell <h1>; its tab heading is an <h2>.
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Insights" })
      .click();
    await expect(page.getByRole("heading", { name: "Insights", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    await goToDashboard(page);
  });
});
