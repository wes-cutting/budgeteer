/**
 * BUD-S91 — WCAG 2.2 AA scan of the SIGN-IN page (axe-core), the one shipped surface the #16
 * consolidated pass never reached.
 *
 * Why a separate file rather than another describe in `a11y.spec.ts`: this page is only reachable
 * WITHOUT a session, so these tests must opt out of global-setup's shared `storageState` — and
 * `a11y.spec.ts` has a file-wide `afterEach` that navigates back to the dashboard, which an
 * unauthenticated page cannot do (it bounces to /login, where the sidebar does not exist). Same
 * reasoning that already puts `auth.spec.ts` in its own file.
 *
 * These tests never sign in and never sign out, so they cannot revoke the shared session the rest
 * of the (serial) suite depends on. The error-state tests deliberately fail a login: each uses a
 * UNIQUE, NON-EXISTENT username, because the BUD-S89 throttle is keyed on (client IP + username) —
 * so a failed attempt here can never count against the real admin's 5-fail budget.
 *
 * Run with: npm run test:e2e -- e2e/a11y-auth.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ storageState: { cookies: [], origins: [] } });

async function assertNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  // Filter to serious/critical only to avoid best-practice noise (same bar as a11y.spec.ts).
  const blocking = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(
    blocking,
    `axe violations:\n${blocking.map((v) => `[${v.impact}] ${v.id}: ${v.description}\n  nodes: ${v.nodes.map((n) => n.html).join(" | ")}`).join("\n")}`,
  ).toEqual([]);
}

/** The signed-out sign-in form. Asserts the form is really rendered before scanning it. */
async function scanSignIn(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to Budgeteer", level: 1 })).toBeVisible();
  await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
  await assertNoViolations(page);
}

/**
 * The sign-in form's ERROR state — the `role="alert"` a failed sign-in renders. Its own surface:
 * error text is where colour-contrast and error-identification (WCAG 3.3.1) failures live, and it
 * is styled by a token nothing else on the page uses.
 */
async function scanSignInError(page: Page) {
  await page.goto("/login");
  const form = page.getByRole("form", { name: "Sign in" });
  // A unique, non-existent username — see the throttle note in the file header.
  await form.getByLabel("Username").fill(`nobody-${Date.now()}`);
  await form.getByLabel("Password").fill("definitely-not-the-password");
  await form.getByRole("button", { name: "Sign in" }).click();
  // Prove the error actually rendered before scanning, so a passing scan can't be a scan of nothing.
  await expect(page.getByRole("alert")).toBeVisible();
  await assertNoViolations(page);
}

test.describe("a11y — sign-in page (BUD-S87)", () => {
  test("the sign-in page is accessible", async ({ page }) => {
    await scanSignIn(page);
  });

  test("the sign-in page's error state is accessible", async ({ page }) => {
    await scanSignInError(page);
  });

  test.describe("dark mode", () => {
    test.use({ colorScheme: "dark" });

    test("the sign-in page is accessible in dark mode", async ({ page }) => {
      await scanSignIn(page);
    });

    test("the sign-in page's error state is accessible in dark mode", async ({ page }) => {
      await scanSignInError(page);
    });
  });
});
