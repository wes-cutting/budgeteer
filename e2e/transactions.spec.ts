import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope, goToDashboard } from "./setup";

test("single allocation: deposit fully allocated — balance derived end to end", async ({
  page,
}) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Groceries ${stamp}`;
  const PAYEE = `E2E Paycheck ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE);

  // Open the account register and record a $500 deposit allocated to the envelope.
  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("500.00");
  await txnForm.getByLabel("Payee").fill(PAYEE);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();

  // Row shows fully allocated; account balance derived from the allocation.
  const txnRow = page
    .getByRole("list", { name: "Transactions" })
    .getByRole("listitem")
    .filter({ hasText: PAYEE });
  await expect(txnRow).toContainText("$500.00");
  await expect(txnRow).toContainText("fully allocated");
  await expect(page.getByText("Balance: $500.00", { exact: true })).toBeVisible();

  // Back on the dashboard: the envelope balance is derived from that allocation.
  await page.getByRole("button", { name: "← Dashboard" }).click();
  const envelopeRow = page
    .getByRole("list", { name: "Envelopes list" })
    .getByRole("listitem")
    .filter({ hasText: ENVELOPE });
  await expect(envelopeRow).toContainText("$500.00");
});

test("split allocation: deposit split across two envelopes", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE_A = `E2E Food ${stamp}`;
  const ENVELOPE_B = `E2E Travel ${stamp}`;
  const PAYEE = `E2E Paycheck ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE_A);
  await createEnvelope(page, ENVELOPE_B);

  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("100.00");
  await txnForm.getByLabel("Payee").fill(PAYEE);

  // Switch to split mode and fill two rows: $60 + $40 = $100.
  await page.getByRole("radio", { name: "Split" }).check();
  await page.getByLabel("Envelope for row 1").selectOption({ label: ENVELOPE_A });
  await page.getByLabel("Amount for row 1").fill("60.00");
  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByLabel("Envelope for row 2").selectOption({ label: ENVELOPE_B });
  await page.getByLabel("Amount for row 2").fill("40.00");

  await page.getByRole("button", { name: "Save transaction" }).click();

  const txnRow = page
    .getByRole("list", { name: "Transactions" })
    .getByRole("listitem")
    .filter({ hasText: PAYEE });
  await expect(txnRow).toContainText("fully allocated");
  await expect(txnRow).toContainText("$100.00");
});

test("partial allocation: unallocated deposit surfaces in Needs allocation", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const PAYEE = `E2E Partial ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);

  // Enter a $200 deposit in Split mode with no allocation rows filled.
  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("200.00");
  await txnForm.getByLabel("Payee").fill(PAYEE);
  await page.getByRole("radio", { name: "Split" }).check();
  await page.getByRole("button", { name: "Save transaction" }).click();

  // Transaction appears in the register with "needs $200.00".
  const txnRow = page
    .getByRole("list", { name: "Transactions" })
    .getByRole("listitem")
    .filter({ hasText: PAYEE });
  await expect(txnRow).toContainText("needs $200.00");

  // It also surfaces in the Needs allocation view.
  await page.getByRole("button", { name: "Needs allocation" }).click();
  await expect(page.getByText(PAYEE)).toBeVisible();
});

test("edit a past split: change the envelope allocation via the inline editor", async ({
  page,
}) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE_A = `E2E Food ${stamp}`;
  const ENVELOPE_B = `E2E Travel ${stamp}`;
  const PAYEE = `E2E Edit ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE_A);
  await createEnvelope(page, ENVELOPE_B);

  // Create a $100 deposit allocated to ENVELOPE_A.
  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("100.00");
  await txnForm.getByLabel("Payee").fill(PAYEE);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE_A });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();

  const txnList = page.getByRole("list", { name: "Transactions" });
  const txnRow = txnList.getByRole("listitem").filter({ hasText: PAYEE });
  await expect(txnRow).toContainText("fully allocated");

  // Open the inline editor and switch the allocation from ENVELOPE_A to ENVELOPE_B.
  await txnRow.getByRole("button", { name: "Edit split" }).click();
  await txnRow.getByRole("combobox", { name: "Envelope" }).selectOption({ label: ENVELOPE_B });
  await txnRow.getByRole("button", { name: "Save split" }).click();

  // Still fully allocated — the round-trip succeeded.
  await expect(txnRow).toContainText("fully allocated");
});

test("refund row: withdrawal with a refund results in the correct net spend", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Food ${stamp}`;
  const PAYEE = `E2E Refund ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT, { balance: "500.00" });
  await createEnvelope(page, ENVELOPE);

  // $80 withdrawal: ENVELOPE charged $100 (normal) + $20 refund back → net = $80.
  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByLabel("Transaction amount").fill("80.00");
  await txnForm.getByLabel("Payee").fill(PAYEE);
  await page.getByRole("radio", { name: "Split" }).check();
  await page.getByLabel("Envelope for row 1").selectOption({ label: ENVELOPE });
  await page.getByLabel("Amount for row 1").fill("100.00");
  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByLabel("Envelope for row 2").selectOption({ label: ENVELOPE });
  await page.getByLabel("Amount for row 2").fill("20.00");
  await page.getByLabel("Refund for row 2").check();

  await page.getByRole("button", { name: "Save transaction" }).click();

  const txnRow = page
    .getByRole("list", { name: "Transactions" })
    .getByRole("listitem")
    .filter({ hasText: PAYEE });
  await expect(txnRow).toContainText("fully allocated");
  await expect(txnRow).toContainText("-$80.00");
});

test("client-side search filters the register by payee", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const PAYEE_MATCH = `E2E Searchable ${stamp}`;
  const PAYEE_OTHER = `E2E Unrelated ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);

  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  const list = page.getByRole("list", { name: "Transactions" });

  // Two unallocated deposits with distinct payees, both dated today → current-month window.
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await page.getByRole("radio", { name: "Split" }).check();
  await txnForm.getByLabel("Transaction amount").fill("50.00");
  await txnForm.getByLabel("Payee").fill(PAYEE_MATCH);
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  // Wait for the first row to land (so the form has cleared) before entering the second.
  await expect(list.getByRole("listitem").filter({ hasText: PAYEE_MATCH })).toBeVisible();

  await txnForm.getByLabel("Transaction amount").fill("30.00");
  await txnForm.getByLabel("Payee").fill(PAYEE_OTHER);
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  await expect(list.getByRole("listitem").filter({ hasText: PAYEE_OTHER })).toBeVisible();

  // Searching by the unique payee hides the other row (client-side, no reload).
  await page.getByLabel("Search payee or memo").fill(PAYEE_MATCH);
  await expect(list.getByRole("listitem").filter({ hasText: PAYEE_MATCH })).toBeVisible();
  await expect(list.getByRole("listitem").filter({ hasText: PAYEE_OTHER })).toHaveCount(0);
});

test("delete transaction: row disappears and balance reverts", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Food ${stamp}`;
  const PAYEE = `E2E DelTxn ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT, { balance: "200.00" });
  await createEnvelope(page, ENVELOPE);

  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("100.00");
  await txnForm.getByLabel("Payee").fill(PAYEE);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();

  // Verify the transaction exists and balance reflects it.
  const txnList = page.getByRole("list", { name: "Transactions" });
  const txnRow = txnList.getByRole("listitem").filter({ hasText: PAYEE });
  await expect(txnRow).toBeVisible();
  await expect(page.getByText("Balance: $300.00", { exact: true })).toBeVisible();

  // Delete the transaction.
  await txnRow.getByRole("button", { name: "Delete transaction" }).click();

  // Row is gone and balance reverts to $200 (opening only).
  await expect(txnRow).not.toBeVisible();
  await expect(page.getByText("Balance: $200.00", { exact: true })).toBeVisible();

  // Envelope balance also reverts: verify on dashboard.
  await goToDashboard(page);
  const envelopeRow = page
    .getByRole("list", { name: "Envelopes list" })
    .getByRole("listitem")
    .filter({ hasText: ENVELOPE });
  await expect(envelopeRow).toContainText("$0.00");
});
