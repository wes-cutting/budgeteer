import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope, goToEnvelopes, goToManage, openAccount } from "./setup";

test("account transfer: move money between two accounts", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT_FROM = `E2E Checking ${stamp}`;
  const ACCOUNT_TO = `E2E Savings ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT_FROM, { balance: "500.00" });
  await createAccount(page, ACCOUNT_TO);

  // Open ACCOUNT_FROM's register and transfer $200 to ACCOUNT_TO.
  await openAccount(page, ACCOUNT_FROM);
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
  await openAccount(page, ACCOUNT);
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("300.00");
  await txnForm.getByLabel("Payee").fill(PAYEE);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE_A });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();

  // Move $100 from ENVELOPE_A to ENVELOPE_B via the Move-money tool on /manage (UX6).
  await goToManage(page);
  const moveForm = page.getByRole("form", { name: "Move money between envelopes" });
  await moveForm.getByLabel("From envelope").selectOption({ label: ENVELOPE_A });
  await moveForm.getByLabel("To envelope").selectOption({ label: ENVELOPE_B });
  await moveForm.getByLabel("Amount").fill("100.00");
  await moveForm.getByRole("button", { name: "Move money" }).click();

  // ENVELOPE_A = $200, ENVELOPE_B = $100 after the reallocation (balances shown on /envelopes).
  await goToEnvelopes(page);
  const envelopeList = page.getByRole("list", { name: "Envelopes list" });
  const rowA = envelopeList.getByRole("listitem").filter({ hasText: ENVELOPE_A });
  const rowB = envelopeList.getByRole("listitem").filter({ hasText: ENVELOPE_B });
  await expect(rowA).toContainText("$200.00");
  await expect(rowB).toContainText("$100.00");
});

test("delete transfer: both legs removed and account balances restored", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT_FROM = `E2E Checking ${stamp}`;
  const ACCOUNT_TO = `E2E Savings ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT_FROM, { balance: "500.00" });
  await createAccount(page, ACCOUNT_TO);

  // Create a $300 transfer from ACCOUNT_FROM to ACCOUNT_TO.
  await openAccount(page, ACCOUNT_FROM);
  const transferForm = page.getByRole("form", { name: "Transfer money" });
  await transferForm.getByLabel("To account").selectOption({ label: ACCOUNT_TO });
  await transferForm.getByLabel("Amount").fill("300.00");
  await transferForm.getByRole("button", { name: "Transfer" }).click();

  // FROM balance is now $200.
  await expect(page.getByText("Balance: $200.00", { exact: true })).toBeVisible();

  // Delete the outgoing transfer leg.
  const txnList = page.getByRole("list", { name: "Transactions" });
  const transferRow = txnList
    .getByRole("listitem")
    .filter({ hasText: `Transfer to ${ACCOUNT_TO}` });
  await expect(transferRow).toBeVisible();
  await transferRow.getByRole("button", { name: "Delete transfer" }).click();

  // Both legs gone: FROM balance back to $500.
  await expect(transferRow).not.toBeVisible();
  await expect(page.getByText("Balance: $500.00", { exact: true })).toBeVisible();
});
