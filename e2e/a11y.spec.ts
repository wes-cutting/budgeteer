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
  createRecurringRule,
  goToDashboard,
  goToManage,
  openAccount,
  openAnalysis,
  openEnvelope,
  openNeeds,
  openPayPeriods,
  openQuickAdd,
  openRecurring,
  openTemplates,
} from "./setup";

const ACCOUNT = `A11y-Acct-${Date.now()}`;
const ENVELOPE = `A11y-Env-${Date.now()}`;

// UX8 — seed helpers so the Insights views render their hand-rolled charts (not empty states) before
// the axe scan. Each returns the entity names so the test can drive the inline editors.

/** Fund an envelope with an allocated deposit, so spend/budget/net-worth have data to chart. */
async function fundEnvelope(page: Page, account: string, envelope: string, payee: string) {
  await openAccount(page, account);
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("500.00");
  await txnForm.getByLabel("Payee").fill(payee);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: envelope });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  await goToDashboard(page);
}

/** Seed spend/budget/forecast data (account + envelope + funded deposit + a monthly target). */
async function seedBudgeted(page: Page, tag: string): Promise<{ envelope: string }> {
  const stamp = `${tag}-${Date.now()}`;
  const account = `A11y-${stamp}-acct`;
  const envelope = `A11y-${stamp}-env`;
  await createAccount(page, account);
  await createEnvelope(page, envelope);
  await fundEnvelope(page, account, envelope, `A11y-${stamp}-pay`);
  await openAnalysis(page, "Budget");
  const budgetRow = page.getByRole("row").filter({ hasText: envelope });
  await budgetRow.getByLabel(`Monthly target for ${envelope}`).fill("200.00");
  await budgetRow.getByRole("button", { name: "Save" }).click();
  await expect(budgetRow.getByRole("button", { name: "Clear" })).toBeVisible();
  return { envelope };
}

/** Record a withdrawal that spends `amount` from `envelope` (single allocation), creating OUTFLOW. */
async function spend(page: Page, account: string, envelope: string, amount: string, payee: string) {
  await openAccount(page, account);
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Withdrawal" }).check();
  await txnForm.getByLabel("Transaction amount").fill(amount);
  await txnForm.getByLabel("Payee").fill(payee);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: envelope });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  await goToDashboard(page);
}

/** Seed real outflow across two envelopes so the spending-breakdown ranked bars render (UX9). */
async function seedSpending(page: Page, tag: string) {
  const stamp = `${tag}-${Date.now()}`;
  const account = `A11y-${stamp}-acct`;
  const envA = `A11y-${stamp}-food`;
  const envB = `A11y-${stamp}-fun`;
  await createAccount(page, account, { balance: "1000.00" });
  await createEnvelope(page, envA);
  await createEnvelope(page, envB);
  await spend(page, account, envA, "300.00", `A11y-${stamp}-payA`);
  await spend(page, account, envB, "120.00", `A11y-${stamp}-payB`);
}

/** Record a withdrawal on a specific date, so trend data can be backdated into an earlier month. */
async function spendOn(
  page: Page,
  account: string,
  envelope: string,
  amount: string,
  occurredOn: string,
  payee: string,
) {
  await openAccount(page, account);
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Withdrawal" }).check();
  await txnForm.getByLabel("Transaction amount").fill(amount);
  await txnForm.getByLabel("Date").fill(occurredOn);
  await txnForm.getByLabel("Payee").fill(payee);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: envelope });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  await goToDashboard(page);
}

/** Seed real outflow across TWO months (this month + last month) so the trends line chart shows
 *  genuine month-over-month movement, not a single flat point (UX10). */
async function seedTrend(page: Page, tag: string) {
  const stamp = `${tag}-${Date.now()}`;
  const account = `A11y-${stamp}-acct`;
  const envelope = `A11y-${stamp}-env`;
  await createAccount(page, account, { balance: "1000.00" });
  await createEnvelope(page, envelope);
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-15`;
  const thisMonthDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
  await spendOn(page, account, envelope, "150.00", lastMonth, `A11y-${stamp}-payA`);
  await spendOn(page, account, envelope, "220.00", thisMonthDay, `A11y-${stamp}-payB`);
}

/** Seed a budgeted envelope with real mid-month outflow so the burn-down gauge + pace marker render
 *  (UX11). Spends more than half the target so the current (partly-elapsed) month has a live pace. */
async function seedBurndown(page: Page, tag: string) {
  const stamp = `${tag}-${Date.now()}`;
  const account = `A11y-${stamp}-acct`;
  const envelope = `A11y-${stamp}-env`;
  await createAccount(page, account, { balance: "1000.00" });
  await createEnvelope(page, envelope);
  await openAnalysis(page, "Budget");
  const budgetRow = page.getByRole("row").filter({ hasText: envelope });
  await budgetRow.getByLabel(`Monthly target for ${envelope}`).fill("200.00");
  await budgetRow.getByRole("button", { name: "Save" }).click();
  await expect(budgetRow.getByRole("button", { name: "Clear" })).toBeVisible();
  // Spend $150 of the $200 target THIS month so the gauge is populated with a real ratio.
  const now = new Date();
  const midMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
  await spendOn(page, account, envelope, "150.00", midMonth, `A11y-${stamp}-pay`);
}

/** Seed a credit account with a limit so the utilization gauge renders. */
async function seedCredit(page: Page, tag: string): Promise<{ card: string }> {
  const card = `A11y-${tag}-${Date.now()}-card`;
  await createAccount(page, card, { kind: "credit", balance: "-300.00" });
  await openAnalysis(page, "Credit");
  const form = page.getByRole("form", { name: `Credit limit for ${card}` });
  await form.getByLabel(`Credit limit for ${card}`).fill("1000.00");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("30.0%").first()).toBeVisible();
  return { card };
}

/** Seed a loan account with an original principal so the payoff gauge renders. */
async function seedLoan(page: Page, tag: string): Promise<{ loan: string }> {
  const loan = `A11y-${tag}-${Date.now()}-loan`;
  await createAccount(page, loan, { kind: "loan", balance: "-7500.00" });
  await openAnalysis(page, "Payoff");
  const form = page.getByRole("form", { name: `Original principal for ${loan}` });
  await form.getByLabel(`Original principal for ${loan}`).fill("10000.00");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("25.0%").first()).toBeVisible();
  return { loan };
}

/** Every Insights chart is a `role="img"` SVG with a one-line summary name (ADR-0007). */
async function expectChart(page: Page) {
  await expect(page.getByRole("img").first()).toBeVisible();
}

/** Seed a budgeted envelope spent OVER its target, then scan the budget table — so the UX13
 *  over-budget encoding (danger progress fill + hatch SHAPE, weighted remaining) is axe-gated with
 *  it VISIBLE. `scanBudget` already covers the under-budget (accent) state. */
async function scanOverBudget(page: Page) {
  const stamp = `over-${Date.now()}`;
  const account = `A11y-${stamp}-acct`;
  const envelope = `A11y-${stamp}-env`;
  await createAccount(page, account, { balance: "1000.00" });
  await createEnvelope(page, envelope);
  await openAnalysis(page, "Budget");
  const budgetRow = page.getByRole("row").filter({ hasText: envelope });
  await budgetRow.getByLabel(`Monthly target for ${envelope}`).fill("200.00");
  await budgetRow.getByRole("button", { name: "Save" }).click();
  await expect(budgetRow.getByRole("button", { name: "Clear" })).toBeVisible();
  await spend(page, account, envelope, "250.00", `A11y-${stamp}-pay`); // 250 of a 200 target ⇒ over
  await openAnalysis(page, "Budget");
  await expect(
    page.getByRole("heading", { name: "Insights — budget vs. actual", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("-$50.00").first()).toBeVisible(); // over-budget remaining is rendered
  await assertNoViolations(page);
}

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

// FEAT-UXR1 — the sidebar shell's two new chrome states are new a11y surfaces: the collapsed RAIL
// (icon-only nav, accessible names carried on aria-label, count as a decorative dot) and the
// off-canvas DRAWER (a modal side-sheet on the Radix Dialog machinery). Shared scan fns so the
// dark-mode block re-runs the exact same states under the dark token set.

/** Collapse the desktop sidebar to the rail, then axe-scan (icon-only nav + persisted toggle). */
async function scanRail(page: Page) {
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await assertNoViolations(page);
}

/** At phone width, open the off-canvas nav drawer, then axe-scan it OPEN (focus-trapped modal). */
async function scanDrawer(page: Page) {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
  await assertNoViolations(page);
  await page.keyboard.press("Escape"); // close so the shared afterEach can navigate home
}

// UX14 — first-run onboarding. Placed FIRST so it runs before any test seeds the run-scoped (never
// reset) e2e store — i.e. against a GENUINELY empty app, where the home derives first-run and shows
// the guided onboarding. Scanned in DARK here and in LIGHT by the "a11y — home (cockpit)" block
// below, so the empty guided surface is axe-gated in BOTH schemes with it visible.
test.describe("a11y — first-run onboarding (UX14, dark)", () => {
  test.use({ colorScheme: "dark" });

  test("the empty-app first-run onboarding is accessible in dark mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Get started" })).toBeVisible();
    await assertNoViolations(page);
  });
});

test.describe("a11y — home (cockpit)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  });

  test("first-run onboarding (empty app) is accessible", async ({ page }) => {
    // Still an empty store here (only the dark onboarding scan above has run, which seeds nothing),
    // so the home shows the guided onboarding — scan it in LIGHT with the surface VISIBLE (UX14).
    await expect(page.getByRole("region", { name: "Get started" })).toBeVisible();
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

// UX7 — the global quick-add transaction modal (Radix Dialog). Modal a11y is the slice's headline
// risk: focus trap, ESC/overlay close, return-focus, role="dialog" + aria — scan it open.
test.describe("a11y — Quick-add transaction (UX7)", () => {
  test("the global quick-add modal is accessible", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `${ACCOUNT}-qa`);
    await goToDashboard(page);
    await openQuickAdd(page);
    await expect(page.getByRole("dialog", { name: "Add a transaction" })).toBeVisible();
    await assertNoViolations(page);
    // Close so the shared afterEach (goToDashboard via the nav) isn't blocked by the open modal.
    await page.keyboard.press("Escape");
  });
});

// UX12 — the destructive-action confirm dialog (Radix ConfirmDialog). Same modal-a11y risk as
// quick-add (focus trap, ESC/overlay close, return-focus, role="dialog" + aria) — scan it OPEN.
test.describe("a11y — destructive-action confirm (UX12)", () => {
  test("the archive confirm dialog is accessible", async ({ page }) => {
    const name = `${ENVELOPE}-confirm`;
    await page.goto("/");
    await createEnvelope(page, name); // leaves us on /envelopes
    await page.getByRole("button", { name: `Archive ${name}`, exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Archive envelope?" })).toBeVisible();
    await assertNoViolations(page);
    await page.keyboard.press("Escape");
  });
});

// UX12d — inline (field-level) validation. Scan a form with an amount field's inline error VISIBLE
// (aria-invalid + aria-describedby pointing at the FieldError message) so the pattern's a11y — the
// invalid-field association AND the --color-danger message contrast — is gated in light AND dark.
test.describe("a11y — inline validation (UX12d)", () => {
  test("an amount field's inline error is accessible", async ({ page }) => {
    await page.goto("/accounts");
    await page.getByRole("button", { name: "Add account" }).click();
    const form = page.getByRole("form", { name: "Add account" });
    const balance = form.getByLabel("Starting balance");
    await balance.fill("12,00"); // not a valid amount
    await balance.blur();
    await expect(form.getByText("Enter an amount like 12.34.")).toBeVisible();
    await assertNoViolations(page);
  });
});

// UX12c — the success toast (Radix Toast). It is an auto-dismissing, animated, polite live region —
// the slice's headline a11y risk — so scan a real mutation's toast while it is VISIBLE: the
// transform-only entrance (no text-opacity fade) and the --color-surface panel contrast, gated in
// light AND dark.
test.describe("a11y — success toast (UX12c)", () => {
  test("a success toast is accessible", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `${ACCOUNT}-toast`); // fires "Account created", leaves us on /accounts
    const toast = page.getByRole("region", { name: "Notifications" }).getByText("Account created");
    await expect(toast).toBeVisible();
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

// UXR4 — the Templates page: the saved-templates table (on the UXR3 treatment) + the new
// form-layout pattern (fieldset/legend, `Field`, the envelope/amount line mini-grid, action row).
// Seed a template so the TABLE markup is axe-scanned too (not just the empty state + form), and run
// the same path in BOTH schemes (watch-out §4 — axe light AND dark).
async function scanTemplates(page: Page) {
  const stamp = Date.now();
  const envelope = `A11y-tpl-${stamp}-env`;
  await createEnvelope(page, envelope);
  await openTemplates(page);
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
  // `exact` so "Name" doesn't substring-match the "Rename {template}" buttons already in the store.
  await page.getByLabel("Name", { exact: true }).fill(`A11y-tpl-${stamp}`);
  await page.getByLabel("Template envelope 1").selectOption({ label: envelope });
  await page.getByLabel("Template amount 1").fill("250.00");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByRole("table", { name: "Templates" })).toBeVisible();
  await assertNoViolations(page);
}

test.describe("a11y — Templates (UXR4)", () => {
  test("templates table + form-layout is accessible", async ({ page }) => {
    await page.goto("/");
    await scanTemplates(page);
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

// UX8 — the six Insights views, each now charted (ADR-0007 hand-rolled SVG + data-table fallback).
// Seed data so the CHART renders (not the empty state), assert the role="img" chart is present, then
// axe-scan — covering the new SVG content, the --chart-* token contrast, and the data table together.
// Shared scan fns so the dark-mode block re-runs the exact same paths under the dark token set.

async function scanNetWorth(page: Page) {
  await seedBudgeted(page, "nw");
  await openAnalysis(page, "Net worth");
  await expect(
    page.getByRole("heading", { name: "Insights — net worth over time", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  await assertNoViolations(page);
}

async function scanSpend(page: Page) {
  await seedBudgeted(page, "spend");
  await openAnalysis(page, "Spend");
  await expect(
    page.getByRole("heading", { name: "Insights — spend by envelope", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  await assertNoViolations(page);
}

async function scanBreakdown(page: Page) {
  await seedSpending(page, "brk"); // real outflow across two envelopes
  await openAnalysis(page, "Breakdown");
  await expect(
    page.getByRole("heading", { name: "Insights — spending breakdown", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  await assertNoViolations(page);
}

async function scanTrends(page: Page) {
  await seedTrend(page, "trend"); // real outflow across two months, one envelope
  await openAnalysis(page, "Trends");
  await expect(
    page.getByRole("heading", { name: "Insights — spending trends", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  await assertNoViolations(page);
}

async function scanBudget(page: Page) {
  await seedBudgeted(page, "budget"); // leaves us on the Budget view with a target set
  await expect(
    page.getByRole("heading", { name: "Insights — budget vs. actual", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  await assertNoViolations(page);
}

async function scanBurndown(page: Page) {
  await seedBurndown(page, "burn"); // budgeted envelope + mid-month outflow
  await openAnalysis(page, "Burn-down");
  await expect(
    page.getByRole("heading", { name: "Insights — budget burn-down", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  await assertNoViolations(page);
}

async function scanForecast(page: Page) {
  await seedBudgeted(page, "fc"); // a target gives the projection expected-spend events to chart
  await openAnalysis(page, "Forecast");
  await expect(
    page.getByRole("heading", { name: "Insights — cash-flow forecast", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  await assertNoViolations(page);
}

/** Seed an expected paycheck + a covered bill for the pay-periods view (S7); returns the account. */
async function seedPayPeriods(page: Page): Promise<string> {
  const stamp = `pp-${Date.now()}`;
  const account = `A11y-${stamp}-acct`;
  const plus = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const pad = (x: number): string => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  await createAccount(page, account, { balance: "1000.00" });
  await createEnvelope(page, `A11y-${stamp}-salary`);
  await createEnvelope(page, `A11y-${stamp}-rent`);
  await createRecurringRule(page, {
    account,
    kind: "Deposit",
    amount: "2000.00",
    payee: `A11y-${stamp}-pay`,
    anchorOn: plus(10),
    envelope: `A11y-${stamp}-salary`,
  });
  await createRecurringRule(page, {
    account,
    kind: "Withdrawal",
    amount: "1500.00",
    payee: `A11y-${stamp}-bill`,
    anchorOn: plus(25),
    envelope: `A11y-${stamp}-rent`,
  });
  return account;
}

async function openPayPeriodsFor(page: Page, account: string) {
  await openPayPeriods(page);
  await expect(page).toHaveURL(/\/pay-periods$/);
  await page.getByLabel("Account", { exact: true }).selectOption({ label: account });
  await expect(page.getByRole("region", { name: "Paychecks" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Bills" })).toBeVisible();
}

/** Scan the populated pay-periods planner (FEAT-UXR2): the two side-by-side ledgers, each table in
 *  its focusable scroll region, the payday selection toggles, and the Covered/breaks text badges. */
async function scanPayPeriods(page: Page) {
  const account = await seedPayPeriods(page);
  await openPayPeriodsFor(page, account);
  await assertNoViolations(page);
}

async function scanCredit(page: Page) {
  await seedCredit(page, "util"); // leaves us on the Credit view with a limit set
  await expect(
    page.getByRole("heading", { name: "Insights — credit utilization", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  await assertNoViolations(page);
}

async function scanPayoff(page: Page) {
  await seedLoan(page, "pay"); // leaves us on the Payoff view with a principal set
  await expect(
    page.getByRole("heading", { name: "Insights — debt payoff", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  await assertNoViolations(page);
}

test.describe("a11y — Insights views (UX8 charts)", () => {
  test("net worth (line chart) is accessible", async ({ page }) => {
    await page.goto("/");
    await scanNetWorth(page);
  });
  test("spend by envelope (bar chart) is accessible", async ({ page }) => {
    await page.goto("/");
    await scanSpend(page);
  });
  test("spending breakdown (ranked bars) is accessible", async ({ page }) => {
    await page.goto("/");
    await scanBreakdown(page);
  });
  test("spending trends (line chart) is accessible", async ({ page }) => {
    await page.goto("/");
    await scanTrends(page);
  });
  test("budget vs. actual (grouped bars) is accessible", async ({ page }) => {
    await page.goto("/");
    await scanBudget(page);
  });
  test("budget burn-down (gauge) is accessible", async ({ page }) => {
    await page.goto("/");
    await scanBurndown(page);
  });
  test("cash-flow forecast (line chart) is accessible", async ({ page }) => {
    await page.goto("/");
    await scanForecast(page);
  });
  test("pay periods (two ledgers) is accessible (UXR2)", async ({ page }) => {
    await page.goto("/");
    await scanPayPeriods(page);
  });
  test("credit utilization (gauge) is accessible", async ({ page }) => {
    await page.goto("/");
    await scanCredit(page);
  });
  test("debt payoff (gauge) is accessible", async ({ page }) => {
    await page.goto("/");
    await scanPayoff(page);
  });
});

// UX13 — money & budget-health visual encoding. The over-budget state is the headline a11y risk (a
// danger-coloured progress fill): scan the budget table with an OVER-budget row VISIBLE so the fill
// + hatch SHAPE (1.4.11) and the weighted remaining text (1.4.1) are gated in light AND dark.
test.describe("a11y — budget-health encoding (UX13)", () => {
  test("an over-budget progress bar + weighted remaining is accessible", async ({ page }) => {
    await page.goto("/");
    await scanOverBudget(page);
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
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
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

  test("templates table + form-layout is accessible in dark mode (UXR4)", async ({ page }) => {
    await page.goto("/");
    await scanTemplates(page);
  });

  test("quick-add modal is accessible in dark mode (UX7)", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `Dark-QA-${Date.now()}`);
    await goToDashboard(page);
    await openQuickAdd(page);
    await expect(page.getByRole("dialog", { name: "Add a transaction" })).toBeVisible();
    await assertNoViolations(page);
    await page.keyboard.press("Escape");
  });

  test("archive confirm dialog is accessible in dark mode (UX12)", async ({ page }) => {
    const name = `Dark-Confirm-${Date.now()}`;
    await page.goto("/");
    await createEnvelope(page, name); // leaves us on /envelopes
    await page.getByRole("button", { name: `Archive ${name}`, exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Archive envelope?" })).toBeVisible();
    await assertNoViolations(page);
    await page.keyboard.press("Escape");
  });

  test("inline validation error is accessible in dark mode (UX12d)", async ({ page }) => {
    await page.goto("/accounts");
    await page.getByRole("button", { name: "Add account" }).click();
    const form = page.getByRole("form", { name: "Add account" });
    const balance = form.getByLabel("Starting balance");
    await balance.fill("12,00"); // not a valid amount
    await balance.blur();
    await expect(form.getByText("Enter an amount like 12.34.")).toBeVisible();
    await assertNoViolations(page);
  });

  test("success toast is accessible in dark mode (UX12c)", async ({ page }) => {
    await page.goto("/");
    await createAccount(page, `Dark-Toast-${Date.now()}`); // fires "Account created" on /accounts
    const toast = page.getByRole("region", { name: "Notifications" }).getByText("Account created");
    await expect(toast).toBeVisible();
    await assertNoViolations(page);
  });

  // UX8 — re-scan every Insights chart under the dark token set, so the --chart-* stroke/fill
  // contrast (WCAG 1.4.11) is gated in dark too. Same seeded paths as the light block.
  test("net worth chart is accessible in dark mode (UX8)", async ({ page }) => {
    await page.goto("/");
    await scanNetWorth(page);
  });
  test("spend chart is accessible in dark mode (UX8)", async ({ page }) => {
    await page.goto("/");
    await scanSpend(page);
  });
  test("spending breakdown is accessible in dark mode (UX9)", async ({ page }) => {
    await page.goto("/");
    await scanBreakdown(page);
  });
  test("spending trends chart is accessible in dark mode (UX10)", async ({ page }) => {
    await page.goto("/");
    await scanTrends(page);
  });
  test("budget chart is accessible in dark mode (UX8)", async ({ page }) => {
    await page.goto("/");
    await scanBudget(page);
  });
  test("budget burn-down gauge is accessible in dark mode (UX11)", async ({ page }) => {
    await page.goto("/");
    await scanBurndown(page);
  });
  test("forecast chart is accessible in dark mode (UX8)", async ({ page }) => {
    await page.goto("/");
    await scanForecast(page);
  });
  test("pay periods (two ledgers) is accessible in dark mode (UXR2)", async ({ page }) => {
    await page.goto("/");
    await scanPayPeriods(page);
  });
  test("credit gauge is accessible in dark mode (UX8)", async ({ page }) => {
    await page.goto("/");
    await scanCredit(page);
  });
  test("payoff gauge is accessible in dark mode (UX8)", async ({ page }) => {
    await page.goto("/");
    await scanPayoff(page);
  });

  test("over-budget encoding is accessible in dark mode (UX13)", async ({ page }) => {
    await page.goto("/");
    await scanOverBudget(page);
  });

  test("the collapsed rail is accessible in dark mode (UXR1)", async ({ page }) => {
    await page.goto("/");
    await scanRail(page);
  });

  test("the off-canvas nav drawer is accessible in dark mode (UXR1)", async ({ page }) => {
    await page.goto("/");
    await scanDrawer(page);
  });
});

// FEAT-UXR1 — the shell's new chrome states, scanned in LIGHT (the dark block above covers DARK).
test.describe("a11y — sidebar shell (UXR1)", () => {
  test("the collapsed rail is accessible", async ({ page }) => {
    await page.goto("/");
    await scanRail(page);
  });

  test("the off-canvas nav drawer is accessible", async ({ page }) => {
    await page.goto("/");
    await scanDrawer(page);
  });
});

// UX15 — responsive pass. Proof of the slice's whole point: at phone width (320px) the wide Insights
// tables must scroll within their OWN focusable region (WCAG 1.4.10 reflow — data tables are the
// exception), so the PAGE never scrolls horizontally, and the app must stay axe-clean LIGHT AND DARK.
// Seeds at the default desktop viewport (steady form-filling), then shrinks and scans.
const PHONE = { width: 320, height: 800 };

/** Fail if the document scrolls horizontally at phone width (the reflow regression this slice fixes). */
async function assertNoHorizontalPageScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(
    overflow,
    "the page scrolls horizontally at 320px — a table is overflowing the page (WCAG 1.4.10)",
  ).toBeLessThanOrEqual(1);
}

async function scanReflow(page: Page) {
  await seedBudgeted(page, "reflow"); // seed at desktop width
  // Navigate via the sidebar at desktop, THEN shrink — at ≤ 640px the sidebar nav is off-canvas
  // (FEAT-UXR1), so openAnalysis' sidebar links wouldn't be reachable after the resize.
  await openAnalysis(page, "Spend"); // the widest table — one column per month
  await page.setViewportSize(PHONE);
  await expect(
    page.getByRole("heading", { name: "Insights — spend by envelope", level: 2 }),
  ).toBeVisible();
  await expectChart(page);
  // The wide table lives inside a focusable scroll region, so only it scrolls — not the page.
  await expect(page.getByRole("group", { name: /data table/ })).toBeVisible();
  await assertNoHorizontalPageScroll(page);
  await assertNoViolations(page);
}

/** FEAT-UXR2 — the two planner ledgers must reflow at 320px inside their own focusable scroll
 *  regions (UX15), stacking (Paychecks first) without scrolling the page. Seeds at desktop width,
 *  then shrinks and scans. */
async function scanPayPeriodsReflow(page: Page) {
  const account = await seedPayPeriods(page);
  // Open at desktop (the sidebar nav is off-canvas ≤ 640px, FEAT-UXR1), then shrink to phone.
  await openPayPeriodsFor(page, account);
  await page.setViewportSize(PHONE);
  await expect(page.getByRole("group", { name: "Paychecks" }).first()).toBeVisible();
  await expect(page.getByRole("group", { name: "Bills" }).first()).toBeVisible();
  await assertNoHorizontalPageScroll(page);
  await assertNoViolations(page);
}

test.describe("a11y — responsive reflow at phone width (UX15)", () => {
  test("a wide Insights table reflows without page scroll and stays accessible", async ({
    page,
  }) => {
    await page.goto("/");
    await scanReflow(page);
  });

  test("the pay-periods ledgers reflow without page scroll and stay accessible (UXR2)", async ({
    page,
  }) => {
    await page.goto("/");
    await scanPayPeriodsReflow(page);
  });

  test.describe("dark mode", () => {
    test.use({ colorScheme: "dark" });
    test("a wide Insights table reflows and stays accessible in dark mode", async ({ page }) => {
      await page.goto("/");
      await scanReflow(page);
    });
    test("the pay-periods ledgers reflow and stay accessible in dark mode (UXR2)", async ({
      page,
    }) => {
      await page.goto("/");
      await scanPayPeriodsReflow(page);
    });
  });
});

// Cleanup: return to the home so subsequent tests (if any) start clean. Some specs shrink to phone
// width (reflow) or leave the desktop rail collapsed; reset to a desktop viewport first — at ≤ 640px
// the shell's sidebar nav is off-canvas (FEAT-UXR1), so goToDashboard's sidebar link would be hidden.
test.afterEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await goToDashboard(page);
});
