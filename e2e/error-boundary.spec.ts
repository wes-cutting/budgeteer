/**
 * R12 — top-level React error boundary.
 *
 * `main.tsx` carries a dev-only crash hook (`import.meta.env.DEV` + `?boom`) that throws during
 * render — exactly the failure that, before R12, unmounted the whole tree to a blank screen. This
 * drives the real app to that crash and asserts the boundary catches it and shows a recoverable
 * panel instead. (The hook is tree-shaken from the production build; the e2e web server runs the
 * Vite dev server, where it is live.)
 */
import { test, expect } from "@playwright/test";

test.describe("error boundary — top-level render crash", () => {
  test("a render crash shows a recoverable fallback, not a blank screen", async ({ page }) => {
    await page.goto("/?boom=1");

    // The fallback is a live-region alert with a heading and a recovery button — not a blank page.
    const alert = page.getByRole("alert");
    await expect(
      alert.getByRole("heading", { name: "Something went wrong", level: 1 }),
    ).toBeVisible();
    await expect(alert.getByRole("button", { name: "Reload" })).toBeVisible();

    // The normal app shell never mounted (the crash replaced it).
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toHaveCount(0);

    // Recovery: a clean load (no ?boom) renders the real app again.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  });
});
