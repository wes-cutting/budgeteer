/**
 * #16 — consolidated WCAG 2.2 AA pass (axe-core automated scan).
 * Visits the home cockpit and each sub-view with synthetic data seeded; fails on any
 * axe violation at the "serious" or "critical" impact level.
 *
 * Run with: npm run test:e2e -- e2e/a11y.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  createAccount,
  createEnvelope,
  goToDashboard,
  goToManage,
  openAccount,
  openAnalysis,
  openEnvelope,
  openNeeds,
  openRecurring,
  openTemplates,
} from "./setup";

const ACCOUNT = `A11y-Acct-${Date.now()}`;
const ENVELOPE = `A11y-Env-${Date.now()}`;

async function assertNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  // Filter to serious/critical only to avoid best-practice noise.
  const blocking = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(
    blocking,
    `axe violations:\n${blocking.map((v) => `[${v.impact}] ${v.id}: ${v.description}\n  nodes: ${v.nodes.map((n) => n.html).join(" | ")}`).join("\n")}`,
  ).toEqual([]);
}

test.describe("a11y — home (cockpit)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
  });

  test("empty state is accessible", async ({ page }) => {
    await assertNoViolations(page);
  });

  test("populated cockpit is accessible", async ({ page }) => {
    await createAccount(page, `${ACCOUNT}-home`, { balance: "1000.00" });
    await goToDashboard(page);
    await expect(page.getByRole("region", { name: "Overview" })).toBeVisible();
    await assertNoViolations(page);
  });
});

// UX6 — the demoted management surfaces (new this slice): the /accounts · /envelopes CRUD lists
// (progressive Add affordance, name-as-Link items) and the /manage cross-cutting hub.
test.describe("a11y — management surfaces (UX6)", () => {
  test("accounts list is accessible", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `${ACCOUNT}-list`); // leaves us on /accounts
    await assertNoViolations(page);
  });

  test("envelopes list is accessible", async ({ page }) => {
    await page.goto("/");
    await createEnvelope(page, `${ENVELOPE}-list`); // leaves us on /envelopes
    await assertNoViolations(page);
  });

  test("manage hub is accessible", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `${ACCOUNT}-manage`, { balance: "500.00" });
    await createEnvelope(page, `${ENVELOPE}-manage-a`);
    await createEnvelope(page, `${ENVELOPE}-manage-b`);
    await goToManage(page);
    await expect(page.getByRole("table", { name: "Net worth summary" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Move money between envelopes" })).toBeVisible();
    await assertNoViolations(page);
  });
});

test.describe("a11y — Account register", () => {
  test("account register view is accessible", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `${ACCOUNT}-reg`);
    await openAccount(page, `${ACCOUNT}-reg`);
    await assertNoViolations(page);
  });
});

test.describe("a11y — Needs allocation", () => {
  test("needs-allocation view is accessible", async ({ page }) => {
    await page.goto("/");
    await openNeeds(page);
    await expect(page.getByRole("heading", { name: "Needs allocation", level: 1 })).toBeVisible();
    await assertNoViolations(page);
  });
});

test.describe("a11y — Templates", () => {
  test("templates view is accessible", async ({ page }) => {
    await page.goto("/");
    await openTemplates(page);
    await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
    await assertNoViolations(page);
  });
});

test.describe("a11y — Recurring", () => {
  test("recurring view is accessible", async ({ page }) => {
    await page.goto("/");
    await openRecurring(page);
    await expect(page.getByRole("heading", { name: "Recurring", level: 1 })).toBeVisible();
    await assertNoViolations(page);
  });
});

test.describe("a11y — Analysis views", () => {
  test("spend analysis is accessible", async ({ page }) => {
    await page.goto("/");
    await openAnalysis(page, "Spend");
    await expect(
      page.getByRole("heading", { name: "Analysis — spend by envelope", level: 1 }),
    ).toBeVisible();
    await assertNoViolations(page);
  });

  test("budget vs actual is accessible", async ({ page }) => {
    await page.goto("/");
    await openAnalysis(page, "Budget");
    await expect(
      page.getByRole("heading", { name: "Analysis — budget vs. actual", level: 1 }),
    ).toBeVisible();
    await assertNoViolations(page);
  });

  test("cash-flow forecast is accessible", async ({ page }) => {
    await page.goto("/");
    await openAnalysis(page, "Forecast");
    await expect(
      page.getByRole("heading", { name: "Analysis — cash-flow forecast", level: 1 }),
    ).toBeVisible();
    await assertNoViolations(page);
  });

  test("credit utilization is accessible", async ({ page }) => {
    await page.goto("/");
    await openAnalysis(page, "Credit");
    await expect(
      page.getByRole("heading", { name: "Analysis — credit utilization", level: 1 }),
    ).toBeVisible();
    await assertNoViolations(page);
  });

  test("debt payoff is accessible", async ({ page }) => {
    await page.goto("/");
    await openAnalysis(page, "Payoff");
    await expect(
      page.getByRole("heading", { name: "Analysis — debt payoff", level: 1 }),
    ).toBeVisible();
    await assertNoViolations(page);
  });

  test("net worth over time is accessible", async ({ page }) => {
    await page.goto("/");
    await openAnalysis(page, "Net worth");
    await expect(
      page.getByRole("heading", { name: "Analysis — net worth over time", level: 1 }),
    ).toBeVisible();
    await assertNoViolations(page);
  });
});

test.describe("a11y — Error boundary fallback", () => {
  test("the render-crash fallback is accessible", async ({ page }) => {
    // R12 — the dev-only ?boom hook forces a render crash so the top-level boundary's fallback
    // (a new user-facing surface) is reachable for the axe sweep.
    await page.goto("/?boom=1");
    await expect(
      page.getByRole("heading", { name: "Something went wrong", level: 1 }),
    ).toBeVisible();
    await assertNoViolations(page);
    // Leave the crash state so the shared afterEach (goToDashboard) finds the real app.
    await page.goto("/");
  });
});

test.describe("a11y — Envelope ledger", () => {
  test("envelope ledger panel is accessible", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `${ACCOUNT}-ledger`);
    await createEnvelope(page, `${ENVELOPE}-ledger`);
    await openEnvelope(page, `${ENVELOPE}-ledger`);
    await assertNoViolations(page);
  });
});

// UX4 — dark mode (prefers-color-scheme). Re-scan the key surfaces under an emulated dark scheme so
// dark-mode token contrast is gated too: the cockpit home and the UX6 management surfaces.
test.describe("a11y — dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("home cockpit (empty) is accessible in dark mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
    await assertNoViolations(page);
  });

  test("populated home cockpit is accessible in dark mode (UX5)", async ({ page }) => {
    // Seed an account so the cockpit's net-worth + forecast panels render their figures/badges
    // (cards, Badge tones, deep-links, dl figures) under the dark token set.
    await page.goto("/");
    await createAccount(page, `Dark-Cockpit-${Date.now()}`, { balance: "1200.00" });
    await goToDashboard(page);
    await expect(page.getByRole("region", { name: "Overview" })).toBeVisible();
    await assertNoViolations(page);
  });

  test("accounts list is accessible in dark mode (UX6)", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `Dark-Acct-${Date.now()}`);
    await assertNoViolations(page);
  });

  test("envelopes list is accessible in dark mode (UX6)", async ({ page }) => {
    await page.goto("/");
    await createEnvelope(page, `Dark-Env-${Date.now()}`);
    await assertNoViolations(page);
  });

  test("manage hub is accessible in dark mode (UX6)", async ({ page }) => {
    const stamp = Date.now();
    await page.goto("/");
    await createAccount(page, `Dark-Mng-${stamp}`, { balance: "800.00" });
    await createEnvelope(page, `Dark-MngEnv-${stamp}-a`);
    await createEnvelope(page, `Dark-MngEnv-${stamp}-b`);
    await goToManage(page);
    await expect(page.getByRole("table", { name: "Net worth summary" })).toBeVisible();
    await assertNoViolations(page);
  });

  test("account register is accessible in dark mode", async ({ page }) => {
    await page.goto("/");
    const name = `Dark-Reg-${Date.now()}`;
    await createAccount(page, name);
    await openAccount(page, name);
    await assertNoViolations(page);
  });
});

// Cleanup: return to the home so subsequent tests (if any) start clean.
test.afterEach(async ({ page }) => {
  await goToDashboard(page);
});
