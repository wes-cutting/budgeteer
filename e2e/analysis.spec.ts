import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope } from "./setup";

async function fundEnvelope(
  page: Parameters<typeof createAccount>[0],
  account: string,
  envelope: string,
  payee: string,
  amount = "500.00",
) {
  await page.getByRole("button", { name: account }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill(amount);
  await txnForm.getByLabel("Payee").fill(payee);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: envelope });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  await page.getByRole("button", { name: "← Dashboard" }).click();
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

  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis — spend by envelope", level: 1 }),
  ).toBeVisible();

  // The envelope row shows $500.00 (positive = funded, matching the deposit allocation).
  const envelopeRow = page.getByRole("table").getByRole("row").filter({ hasText: ENVELOPE });
  await expect(envelopeRow).toContainText("$500.00");
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

  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis — budget vs. actual", level: 1 }),
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
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  const budgetRow = page.getByRole("row").filter({ hasText: ENVELOPE });
  await budgetRow.getByLabel(`Monthly target for ${ENVELOPE}`).fill("200.00");
  await budgetRow.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "← Dashboard" }).click();
  await page.getByRole("button", { name: "Forecast", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis — cash-flow forecast", level: 1 }),
  ).toBeVisible();
  await page.getByLabel("Account").selectOption({ label: ACCOUNT });

  // The $500 derived starting balance appears, and the expected-spend toggle is shown.
  await expect(page.getByText("$500.00").first()).toBeVisible();
  await expect(page.getByText("Expected discretionary spend").first()).toBeVisible();
});

// FEAT-014a — credit utilization: guards the cross-origin PUT /accounts/:id/credit-limit
test("credit utilization: set a limit and see the utilization percentage", async ({ page }) => {
  const stamp = Date.now();
  const CARD = `E2E Card ${stamp}`;
  await page.goto("/");
  // Credit account already owing $300 (negative opening balance = owed).
  await createAccount(page, CARD, { kind: "credit", balance: "-300.00" });

  await page.getByRole("button", { name: "Credit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis — credit utilization", level: 1 }),
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

  await page.getByRole("button", { name: "Payoff", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis — debt payoff", level: 1 }),
  ).toBeVisible();

  // Set the original principal to $10,000 (a real cross-origin PUT).
  const principalForm = page.getByRole("form", { name: `Original principal for ${LOAN}` });
  await principalForm.getByLabel(`Original principal for ${LOAN}`).fill("10000.00");
  await principalForm.getByRole("button", { name: "Save" }).click();

  // (10,000 − 7,500) ÷ 10,000 = 25.0% paid off.
  await expect(page.getByText("25.0%").first()).toBeVisible();
});
