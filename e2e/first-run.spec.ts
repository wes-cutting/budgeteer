/**
 * BUD-S92 — the cold start. From a store with NO user: load the app, get routed to `/setup`,
 * create the first admin, and arrive at an authenticated dashboard. No CLI, no `curl`, nothing
 * provisioned out of band.
 *
 * This is the acceptance test for the whole slice, and the test whose absence hid the bug for five
 * slices (`KIT_FEEDBACK` K42): every other automated consumer — `global-setup.ts`, the demo
 * capture, the API suites — creates its credential out of band, so the suite has only ever
 * exercised the app *after* the hard part, and a green gate said nothing about whether the product
 * could be opened at all.
 *
 * It runs against the COLD-START stack (`cold-start.ts`), a second API + web pair over its own
 * empty store, for the reason spelled out there: the primary store has an admin before the first
 * spec runs, so this test could not fail for the right reason on it. It also clears
 * `storageState` — belt and braces; that session belongs to the other store's `sessions` table and
 * would resolve to nothing here anyway.
 *
 * ORDER MATTERS, hence `serial` and one file. Completing setup makes `/setup` permanently
 * unreachable on this stack, so every assertion about the setup page — including the axe scans,
 * which BUD-S91 is the precedent for running in-slice — has to come before the journey that
 * consumes it. Playwright runs tests in declaration order.
 *
 * Run with: npm run test:e2e -- e2e/first-run.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { COLD_START_ADMIN, COLD_START_API_ORIGIN, COLD_START_WEB_ORIGIN } from "./cold-start";

test.use({ baseURL: COLD_START_WEB_ORIGIN, storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

// Local copy of the scan helper, matching `a11y.spec.ts` / `a11y-auth.spec.ts` (serious+critical
// only, to keep best-practice noise out of the gate).
async function assertNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(
    blocking,
    `axe violations:\n${blocking.map((v) => `[${v.impact}] ${v.id}: ${v.description}\n  nodes: ${v.nodes.map((n) => n.html).join(" | ")}`).join("\n")}`,
  ).toEqual([]);
}

/** The setup form, proven rendered before it is scanned — a passing scan of nothing proves nothing. */
async function scanSetup(page: Page) {
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Set up Budgeteer", level: 1 })).toBeVisible();
  await expect(page.getByRole("form", { name: "Create the first account" })).toBeVisible();
  await assertNoViolations(page);
}

/**
 * The mismatch ERROR state. Its own surface: error text is where contrast and error-identification
 * (WCAG 3.3.1) failures live, and BUD-S91 found exactly such a defect shipped unnoticed on the
 * sign-in error. Deliberately the CLIENT-SIDE mismatch, so the scan costs no server round trip and
 * cannot consume the one-shot setup.
 */
async function scanSetupError(page: Page) {
  await page.goto("/setup");
  const form = page.getByRole("form", { name: "Create the first account" });
  await form.getByLabel("Username").fill("someone");
  await form.getByLabel("Password", { exact: true }).fill("a-long-enough-password");
  await form.getByLabel("Confirm password").fill("a-different-password");
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await assertNoViolations(page);
}

test.describe("first-run setup (BUD-S92)", () => {
  test("a brand-new install routes the app root to the setup page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole("heading", { name: "Set up Budgeteer", level: 1 })).toBeVisible();
  });

  test("the sign-in page is not a dead end while the store has no user", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("mismatched passwords block submission without a request", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") posts.push(r.url());
    });
    await page.goto("/setup");
    const form = page.getByRole("form", { name: "Create the first account" });
    await form.getByLabel("Username").fill("someone");
    await form.getByLabel("Password", { exact: true }).fill("a-long-enough-password");
    await form.getByLabel("Confirm password").fill("a-different-password");
    await form.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert")).toHaveText(/passwords do not match/i);
    expect(posts).toEqual([]);
  });

  test("the setup page is accessible", async ({ page }) => {
    await scanSetup(page);
  });

  test("the setup page's error state is accessible", async ({ page }) => {
    await scanSetupError(page);
  });

  test.describe("dark mode", () => {
    test.use({ colorScheme: "dark" });

    test("the setup page is accessible in dark mode", async ({ page }) => {
      await scanSetup(page);
    });

    test("the setup page's error state is accessible in dark mode", async ({ page }) => {
      await scanSetupError(page);
    });
  });

  // --- The journey. Everything above must run first: this consumes the one-shot. ---

  test("a new install goes from no user to an authenticated dashboard in the browser alone", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup$/);

    const form = page.getByRole("form", { name: "Create the first account" });
    await form.getByLabel("Username").fill(COLD_START_ADMIN.username);
    await form.getByLabel("Password", { exact: true }).fill(COLD_START_ADMIN.password);
    await form.getByLabel("Confirm password").fill(COLD_START_ADMIN.password);
    await form.getByRole("button", { name: "Create account" }).click();

    // Signed in automatically — no second trip through the sign-in form.
    await expect(page).toHaveURL(`${COLD_START_WEB_ORIGIN}/`);
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    // …and really authenticated: this empty state only renders after gated reads SUCCEED. A shell
    // with a dead session would have bounced back to /login instead.
    await expect(page.getByText("Welcome to Budgeteer")).toBeVisible();
  });

  test("the setup page goes inert once a user exists", async ({ page }) => {
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in to Budgeteer" })).toBeVisible();
  });

  test("the needs-setup probe flips to false and reveals nothing else", async ({ request }) => {
    const res = await request.get(`${COLD_START_API_ORIGIN}/api/auth/needs-setup`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ needsSetup: false });
  });
});
