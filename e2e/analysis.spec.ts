import { expect, test } from "@playwright/test";
import {
  createAccount,
  createEnvelope,
  createRecurringRule,
  goToDashboard,
  openAccount,
  openAnalysis,
  openPayPeriods,
} from "./setup";

async function fundEnvelope(
  page: Parameters<typeof createAccount>[0],
  account: string,
  envelope: string,
  payee: string,
  amount = "500.00",
) {
  await openAccount(page, account);
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill(amount);
  await txnForm.getByLabel("Payee").fill(payee);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: envelope });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  await goToDashboard(page);
}

// FEAT-011 — spend by envelope over time
test("spend by envelope: allocated deposit appears in the monthly grid", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Groceries ${stamp}`;
  const PAYEE = `E2E Paycheck ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE);
  await fundEnvelope(page, ACCOUNT, ENVELOPE, PAYEE);

  await openAnalysis(page, "By envelope");
  await expect(
    page.getByRole("heading", { name: "Insights — spend by envelope", level: 2 }),
  ).toBeVisible();

  // The envelope row shows $500.00 (positive = funded, matching the deposit allocation).
  const envelopeRow = page.getByRole("table").getByRole("row").filter({ hasText: ENVELOPE });
  await expect(envelopeRow).toContainText("$500.00");
});

// FEAT-UX9 — spending breakdown: each envelope's share of the month's OUTFLOW, ranked.
test("spending breakdown: outflow is ranked by share of the month total", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Brk Acct ${stamp}`;
  const FOOD = `E2E Brk Food ${stamp}`;
  const FUN = `E2E Brk Fun ${stamp}`;
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // local (EH8)
  await page.goto("/");
  await createAccount(page, ACCOUNT, { balance: "1000.00" });
  await createEnvelope(page, FOOD);
  await createEnvelope(page, FUN);

  // Two withdrawals this month: Food −$300, Fun −$100.
  const spend = async (envelope: string, amount: string, payee: string) => {
    await openAccount(page, ACCOUNT);
    const txnForm = page.getByRole("form", { name: "Add transaction" });
    await txnForm.getByRole("radio", { name: "Withdrawal" }).check();
    await txnForm.getByLabel("Transaction amount").fill(amount);
    await txnForm.getByLabel("Payee").fill(payee);
    await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: envelope });
    await txnForm.getByRole("button", { name: "Save transaction" }).click();
    await goToDashboard(page);
  };
  await spend(FOOD, "300.00", `E2E Brk PayFood ${stamp}`);
  await spend(FUN, "100.00", `E2E Brk PayFun ${stamp}`);

  await openAnalysis(page, "Breakdown");
  await expect(
    page.getByRole("heading", { name: "Insights — spending breakdown", level: 2 }),
  ).toBeVisible();

  // The shared e2e store accretes outflow from parallel specs, so the household-wide total (and thus
  // exact shares) isn't deterministic. Assert the robust facts instead: each envelope's own outflow,
  // and that Food ($300) is RANKED ABOVE Fun ($100) — true regardless of what else spent this month.
  const table = page.getByRole("table", { name: new RegExp(`Share of ${month} outflow`) });
  await expect(table.getByRole("row", { name: new RegExp(FOOD) })).toContainText("$300.00");
  await expect(table.getByRole("row", { name: new RegExp(FUN) })).toContainText("$100.00");
  const headers = await table.getByRole("rowheader").allTextContents();
  const iFood = headers.findIndex((h) => h.includes(FOOD));
  const iFun = headers.findIndex((h) => h.includes(FUN));
  expect(iFood).toBeGreaterThanOrEqual(0);
  expect(iFun).toBeGreaterThan(iFood);
});

// FEAT-UX10 — spending trends: month-over-month outflow, total + top envelopes.
test("spending trends: an envelope's outflow appears across months in ascending order", async ({
  page,
}) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Trend Acct ${stamp}`;
  const ENVELOPE = `E2E Trend Env ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT, { balance: "50000.00" });
  await createEnvelope(page, ENVELOPE);

  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Two different months, one envelope. The amounts are deliberately large so this envelope
  // dominates the top-2 ranking even under the shared e2e store's parallel-spec noise (the same
  // accretion issue UX9's functional test documents) — only the exact ENVELOPE-scoped cells are
  // asserted below, never the household-wide Total column.
  const spend = async (amount: string, occurredOn: string, payee: string) => {
    await openAccount(page, ACCOUNT);
    const txnForm = page.getByRole("form", { name: "Add transaction" });
    await txnForm.getByRole("radio", { name: "Withdrawal" }).check();
    await txnForm.getByLabel("Transaction amount").fill(amount);
    await txnForm.getByLabel("Date").fill(`${occurredOn}-15`);
    await txnForm.getByLabel("Payee").fill(payee);
    await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE });
    await txnForm.getByRole("button", { name: "Save transaction" }).click();
    await goToDashboard(page);
  };
  await spend("8000.00", lastMonth, `E2E Trend PayA ${stamp}`);
  await spend("12000.00", thisMonth, `E2E Trend PayB ${stamp}`);

  await openAnalysis(page, "Trends");
  await expect(
    page.getByRole("heading", { name: "Insights — spending trends", level: 2 }),
  ).toBeVisible();

  const table = page.getByRole("table", { name: /Monthly outflow/ });
  await expect(table.getByRole("columnheader", { name: ENVELOPE })).toBeVisible();

  const lastRow = table.getByRole("row").filter({ hasText: lastMonth });
  const thisRow = table.getByRole("row").filter({ hasText: thisMonth });
  await expect(lastRow).toContainText("$8,000.00");
  await expect(thisRow).toContainText("$12,000.00");

  // Months are ascending — last month's row precedes this month's.
  const headers = await table.getByRole("rowheader").allTextContents();
  expect(headers.indexOf(lastMonth)).toBeLessThan(headers.indexOf(thisMonth));
});

// FEAT-012 — budget vs. actual: guards the CORS allow-methods fix (cross-origin PUT /envelopes/:id/target)
test("budget vs. actual: set a monthly target and see it against spend", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Groceries ${stamp}`;
  const PAYEE = `E2E Paycheck ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE);
  await fundEnvelope(page, ACCOUNT, ENVELOPE, PAYEE);

  await openAnalysis(page, "vs Actual");
  await expect(
    page.getByRole("heading", { name: "Insights — budget vs. actual", level: 2 }),
  ).toBeVisible();

  // Set a $200 monthly target via the inline editor (a real cross-origin PUT).
  const budgetRow = page.getByRole("row").filter({ hasText: ENVELOPE });
  await budgetRow.getByLabel(`Monthly target for ${ENVELOPE}`).fill("200.00");
  await budgetRow.getByRole("button", { name: "Save" }).click();

  // The deposit FUNDED the envelope (not outflow spend), so spend = $0, remaining = $200.
  await expect(budgetRow).toContainText("$0.00"); // spent
  await expect(budgetRow).toContainText("$200.00"); // remaining = target − spent
  await expect(budgetRow.getByRole("button", { name: "Clear" })).toBeVisible();
});

// FEAT-UX11 — budget burn-down: within-month pace (spent ÷ target) vs. elapsed-time pace.
test("budget burn-down: pace shows spent vs. target for a budgeted envelope", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Burn Acct ${stamp}`;
  const ENVELOPE = `E2E Burn Env ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT, { balance: "5000.00" });
  await createEnvelope(page, ENVELOPE);

  // Set a $200 monthly target, then spend $150 of it THIS month (75% consumed — clock-independent).
  await openAnalysis(page, "vs Actual");
  const budgetRow = page.getByRole("row").filter({ hasText: ENVELOPE });
  await budgetRow.getByLabel(`Monthly target for ${ENVELOPE}`).fill("200.00");
  await budgetRow.getByRole("button", { name: "Save" }).click();
  await expect(budgetRow.getByRole("button", { name: "Clear" })).toBeVisible();

  const now = new Date();
  const midMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
  await openAccount(page, ACCOUNT);
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Withdrawal" }).check();
  await txnForm.getByLabel("Transaction amount").fill("150.00");
  await txnForm.getByLabel("Date").fill(midMonth);
  await txnForm.getByLabel("Payee").fill(`E2E Burn Pay ${stamp}`);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  await goToDashboard(page);

  await openAnalysis(page, "Burn-down");
  await expect(
    page.getByRole("heading", { name: "Insights — budget burn-down", level: 2 }),
  ).toBeVisible();

  // The data-table fallback lists every budgeted envelope (the shared store accretes others across
  // parallel specs), so assert only THIS uniquely-named envelope's own exact cells + consumed %.
  const table = page.getByRole("table", { name: /Budget burn-down/ });
  const envRow = table.getByRole("row").filter({ hasText: ENVELOPE });
  await expect(envRow).toContainText("$200.00"); // target
  await expect(envRow).toContainText("$150.00"); // spent
  await expect(envRow).toContainText("75.0%"); // consumed (150 / 200)

  // Scope the gauge to this envelope — the role="img" summary names it and its exact ratio.
  await page.getByLabel("Scope").selectOption({ label: ENVELOPE });
  await expect(
    page.getByRole("img", { name: new RegExp(`${ENVELOPE}: 75\\.0% of the \\$200\\.00 budget`) }),
  ).toBeVisible();
});

// FEAT-013 — cash-flow forecast
test("cash-flow forecast: forward projection renders with expected spend", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Groceries ${stamp}`;
  const PAYEE = `E2E Paycheck ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE);
  await fundEnvelope(page, ACCOUNT, ENVELOPE, PAYEE);

  // Set a $200 monthly target so expected-spend appears in the forecast.
  await openAnalysis(page, "vs Actual");
  const budgetRow = page.getByRole("row").filter({ hasText: ENVELOPE });
  await budgetRow.getByLabel(`Monthly target for ${ENVELOPE}`).fill("200.00");
  await budgetRow.getByRole("button", { name: "Save" }).click();
  await expect(budgetRow.getByRole("button", { name: "Clear" })).toBeVisible(); // target persisted

  // Switch straight to Forecast — no return to the Dashboard (the point of R3). Under the UXR6
  // category IA, Forecast is the "Cash flow" category's single view, so switch via its category tab
  // in the always-present primary row (the category links are deep-linkable NavLinks, UX3).
  await page
    .getByRole("navigation", { name: "Insights categories" })
    .getByRole("link", { name: "Cash flow", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Insights — cash-flow forecast", level: 2 }),
  ).toBeVisible();
  // exact: true — the Forecast chart's role="img" aria-label ("Projected cash balance for
  // {account} …") can contain the substring "Account", which a non-exact getByLabel also
  // matches (strict-mode collision; the R1 exact-name convention).
  await page.getByLabel("Account", { exact: true }).selectOption({ label: ACCOUNT });

  // The $500 derived starting balance appears, and the expected-spend toggle is shown.
  await expect(page.getByText("$500.00").first()).toBeVisible();
  await expect(page.getByText("Expected discretionary spend").first()).toBeVisible();
});

// FEAT-S7 — pay periods: an expected paycheck's bucket lists the bill it funds (data → API → UI).
test("pay periods: an expected paycheck covers its bill with commitment-time headroom", async ({
  page,
}) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const SALARY = `E2E Salary ${stamp}`;
  const RENT = `E2E RentEnv ${stamp}`;
  const PAYEE = `E2E Paycheck ${stamp}`;
  const BILL = `E2E Rent Bill ${stamp}`;
  // Local calendar dates (EH8) — the app derives today from the browser's local clock.
  const plus = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const pad = (x: number): string => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  await page.goto("/");
  await createAccount(page, ACCOUNT, { balance: "1000.00" });
  await createEnvelope(page, SALARY);
  await createEnvelope(page, RENT);
  // Paycheck +$2,000 in 10 days; rent −$1,500 in 25 days (cutoff +18 → the +10 check covers it).
  await createRecurringRule(page, {
    account: ACCOUNT,
    kind: "Deposit",
    amount: "2000.00",
    payee: PAYEE,
    anchorOn: plus(10),
    envelope: SALARY,
  });
  await createRecurringRule(page, {
    account: ACCOUNT,
    kind: "Withdrawal",
    amount: "1500.00",
    payee: BILL,
    anchorOn: plus(25),
    envelope: RENT,
  });

  // FEAT-UXR2 — Pay periods is a first-class route (sidebar Planning group), re-laid as two ledgers.
  await openPayPeriods(page);
  await expect(page).toHaveURL(/\/pay-periods$/);
  // The sidebar's Planning item marks itself active (retiring the UXR1 transitional dual-highlight).
  await expect(page.getByRole("link", { name: "Pay periods" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByLabel("Account", { exact: true }).selectOption({ label: ACCOUNT });

  const bills = page.getByRole("region", { name: "Bills" });
  const paychecks = page.getByRole("region", { name: "Paychecks" });
  await expect(bills).toBeVisible();
  await expect(paychecks).toBeVisible();

  // Bills ledger: the rent bill is listed and its "Covered by" text names a paycheck — the permanent
  // structural join (never colour). Rent recurs monthly, so take the first matching row.
  await expect(bills.getByRole("rowheader", { name: BILL }).first()).toBeVisible();
  await expect(bills.getByText(/ check$/).first()).toBeVisible();

  // Paycheck ledger: the +10 payday carries income and a status badge, and is a selection toggle.
  await expect(paychecks.getByText("+$2,000.00").first()).toBeVisible();
  await expect(
    paychecks.getByText(/Covered|Plan breaks here|Short|Over-committed/).first(),
  ).toBeVisible();
  const payToggle = paychecks.getByRole("button", { name: /Highlight bills covered by/ }).first();
  await expect(payToggle).toHaveAttribute("aria-pressed", "false");
  await payToggle.click();
  await expect(payToggle).toHaveAttribute("aria-pressed", "true");
});

// FEAT-UXR2 — the old Insights deep-link redirects to the promoted first-class route. (Store state
// is shared, so assert the redirect itself + that the planner chrome mounted, not populated data.)
test("pay periods: /insights/pay-periods redirects to /pay-periods", async ({ page }) => {
  await page.goto("/insights/pay-periods");
  await expect(page).toHaveURL(/\/pay-periods$/);
  await expect(page.getByRole("link", { name: "Pay periods" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

// FEAT-014a — credit utilization: guards the cross-origin PUT /accounts/:id/credit-limit
test("credit utilization: set a limit and see the utilization percentage", async ({ page }) => {
  const stamp = Date.now();
  const CARD = `E2E Card ${stamp}`;
  await page.goto("/");
  // Credit account already owing $300 (negative opening balance = owed).
  await createAccount(page, CARD, { kind: "credit", balance: "-300.00" });

  await openAnalysis(page, "Credit");
  await expect(
    page.getByRole("heading", { name: "Insights — credit utilization", level: 2 }),
  ).toBeVisible();

  // Set the limit to $1,000 via the inline editor (a real cross-origin PUT).
  const limitForm = page.getByRole("form", { name: `Credit limit for ${CARD}` });
  await limitForm.getByLabel(`Credit limit for ${CARD}`).fill("1000.00");
  await limitForm.getByRole("button", { name: "Save" }).click();

  // $300 owed ÷ $1,000 limit = 30.0%.
  await expect(page.getByText("30.0%").first()).toBeVisible();
});

// FEAT-014b — debt payoff: guards the cross-origin PUT /accounts/:id/original-principal and kind='loan'
test("debt payoff: set an original principal and see the payoff percentage", async ({ page }) => {
  const stamp = Date.now();
  const LOAN = `E2E Loan ${stamp}`;
  await page.goto("/");
  // Loan account owing $7,500 (negative balance = owed).
  await createAccount(page, LOAN, { kind: "loan", balance: "-7500.00" });

  await openAnalysis(page, "Payoff");
  await expect(
    page.getByRole("heading", { name: "Insights — debt payoff", level: 2 }),
  ).toBeVisible();

  // Set the original principal to $10,000 (a real cross-origin PUT).
  const principalForm = page.getByRole("form", { name: `Original principal for ${LOAN}` });
  await principalForm.getByLabel(`Original principal for ${LOAN}`).fill("10000.00");
  await principalForm.getByRole("button", { name: "Save" }).click();

  // (10,000 − 7,500) ÷ 10,000 = 25.0% paid off.
  await expect(page.getByText("25.0%").first()).toBeVisible();
});

// FEAT-R9 — net worth over time. A household-wide aggregate with no per-account row, and the e2e DB
// accretes across parallel specs — so we assert the arithmetic INVARIANT (net = assets + liabilities)
// off the rendered current totals, which holds at any render regardless of other tests' accounts.
test("net worth: current totals satisfy net = assets + liabilities, and the month is in the trend", async ({
  page,
}) => {
  const stamp = Date.now();
  const CHECKING = `E2E NW Checking ${stamp}`;
  const CARD = `E2E NW Card ${stamp}`;
  await page.goto("/");
  await createAccount(page, CHECKING, { balance: "1000.00" }); // an asset
  await createAccount(page, CARD, { kind: "credit", balance: "-300.00" }); // a liability (owes $300)

  await openAnalysis(page, "Net worth");
  await expect(
    page.getByRole("heading", { name: "Insights — net worth over time", level: 2 }),
  ).toBeVisible();

  const totals = page.getByRole("table", { name: "Current totals" });
  const cents = async (label: string): Promise<number> => {
    const txt = await totals
      .getByRole("row", { name: new RegExp(label) })
      .getByRole("cell")
      .textContent();
    return Math.round(parseFloat((txt ?? "").replace(/[^0-9.-]/g, "")) * 100);
  };
  const [assets, liabilities, net] = await Promise.all([
    cents("Assets"),
    cents("Liabilities"),
    cents("Net worth"),
  ]);
  // The invariant the whole feature rests on — proven end to end (data → API → domain → UI).
  expect(net).toBe(assets + liabilities);

  // The current month (the opening rows are dated today) appears in the over-time trend.
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // local (EH8)
  await expect(
    page
      .getByRole("table", { name: /Net worth over time/ })
      .getByRole("rowheader", { name: month }),
  ).toBeVisible();
});
