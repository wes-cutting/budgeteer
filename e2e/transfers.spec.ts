import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope } from "./setup";

test("account transfer: move money between two accounts", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT_FROM = `E2E Checking ${stamp}`;
  const ACCOUNT_TO = `E2E Savings ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT_FROM, { balance: "500.00" });
  await createAccount(page, ACCOUNT_TO);

  // Open ACCOUNT_FROM's register and transfer $200 to ACCOUNT_TO.
  await page.getByRole("button", { name: ACCOUNT_FROM }).click();
  const transferForm = page.getByRole("form", { name: "Transfer money" });
  await transferForm.getByLabel("To account").selectOption({ label: ACCOUNT_TO });
  await transferForm.getByLabel("Amount").fill("200.00");
  await transferForm.getByRole("button", { name: "Transfer" }).click();

  // ACCOUNT_FROM balance is now $300 (500 − 200).
  await expect(page.getByText("Balance: $300.00", { exact: true })).toBeVisible();

  // The outgoing transfer leg appears in the register.
  const txnList = page.getByRole("list", { name: "Transactions" });
  const transferRow = txnList
    .getByRole("listitem")
    .filter({ hasText: `Transfer to ${ACCOUNT_TO}` });
  await expect(transferRow).toBeVisible();
  await expect(transferRow).toContainText("-$200.00");
});

test("envelope reallocation: move budgeted money between envelopes", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE_A = `E2E Food ${stamp}`;
  const ENVELOPE_B = `E2E Travel ${stamp}`;
  const PAYEE = `E2E Paycheck ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE_A);
  await createEnvelope(page, ENVELOPE_B);

  // Fund ENVELOPE_A with a $300 deposit.
  await page.getByRole("button", { name: ACCOUNT }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("300.00");
  await txnForm.getByLabel("Payee").fill(PAYEE);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE_A });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();

  // Back on the dashboard, move $100 from ENVELOPE_A to ENVELOPE_B.
  await page.getByRole("button", { name: "← Dashboard" }).click();
  const moveForm = page.getByRole("form", { name: "Move money between envelopes" });
  await moveForm.getByLabel("From envelope").selectOption({ label: ENVELOPE_A });
  await moveForm.getByLabel("To envelope").selectOption({ label: ENVELOPE_B });
  await moveForm.getByLabel("Amount").fill("100.00");
  await moveForm.getByRole("button", { name: "Move money" }).click();

  // ENVELOPE_A = $200, ENVELOPE_B = $100 after the reallocation.
  const envelopeList = page.getByRole("list", { name: "Envelopes list" });
  const rowA = envelopeList.getByRole("listitem").filter({ hasText: ENVELOPE_A });
  const rowB = envelopeList.getByRole("listitem").filter({ hasText: ENVELOPE_B });
  await expect(rowA).toContainText("$200.00");
  await expect(rowB).toContainText("$100.00");
});
