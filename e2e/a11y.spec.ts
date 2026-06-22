/**
 * #16 — consolidated WCAG 2.2 AA pass (axe-core automated scan).
 * Visits the Dashboard and each sub-view with synthetic data seeded; fails on any
 * axe violation at the "serious" or "critical" impact level.
 *
 * Run with: npm run test:e2e -- e2e/a11y.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createAccount, createEnvelope, goToDashboard, openAnalysis } from "./setup";

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

test.describe("a11y — Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
  });

  test("empty state is accessible", async ({ page }) => {
    await assertNoViolations(page);
  });

  test("with account + envelope is accessible", async ({ page }) => {
    await createAccount(page, ACCOUNT);
    await createEnvelope(page, ENVELOPE);
    await assertNoViolations(page);
  });
});

test.describe("a11y — Account register", () => {
  test("account register view is accessible", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `${ACCOUNT}-reg`);
    await page.getByRole("button", { name: `${ACCOUNT}-reg`, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: `${ACCOUNT}-reg` })).toBeVisible();
    await assertNoViolations(page);
  });
});

test.describe("a11y — Needs allocation", () => {
  test("needs-allocation view is accessible", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Needs allocation" }).click();
    await expect(page.getByRole("heading", { name: "Needs allocation", level: 1 })).toBeVisible();
    await assertNoViolations(page);
  });
});

test.describe("a11y — Templates", () => {
  test("templates view is accessible", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Templates" }).click();
    await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
    await assertNoViolations(page);
  });
});

test.describe("a11y — Recurring", () => {
  test("recurring view is accessible", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Recurring" }).click();
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

test.describe("a11y — Envelope ledger", () => {
  test("envelope ledger panel is accessible", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `${ACCOUNT}-ledger`);
    await createEnvelope(page, `${ENVELOPE}-ledger`);
    await page
      .getByRole("list", { name: "Envelopes list" })
      .getByRole("button", { name: `${ENVELOPE}-ledger` })
      .click();
    await expect(
      page.getByRole("heading", { name: `${ENVELOPE}-ledger (standard)`, level: 1 }),
    ).toBeVisible();
    await assertNoViolations(page);
  });
});

// Cleanup: return to Dashboard so subsequent tests (if any) start clean.
test.afterEach(async ({ page }) => {
  await goToDashboard(page);
});
