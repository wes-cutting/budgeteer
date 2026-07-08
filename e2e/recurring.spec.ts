import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope, openAccount, openRecurring } from "./setup";

test("create a monthly recurring rule and post due", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Rent ${stamp}`;
  const PAYEE = `E2E Rent Payment ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE);

  await openRecurring(page);
  await expect(page.getByRole("heading", { name: "Recurring", level: 1 })).toBeVisible();

  // Fill the recurring-rule form: $1,200 monthly withdrawal, anchored in the past so it is due.
  await page.getByLabel("Account").selectOption({ label: ACCOUNT });
  await page.getByLabel("Amount").fill("1200.00");
  await page.getByLabel("Payee").fill(PAYEE);
  await page.getByLabel("Frequency").selectOption("monthly");
  await page.getByLabel("First date").fill("2020-01-01");

  // Allocate the full amount to the envelope in single mode.
  await page.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE });
  await page.getByRole("button", { name: "Create recurring rule" }).click();

  // UXR5 — the rules list is a table; Payee is its own column, the split is behind a per-row
  // disclosure. Assert the rule via its payee cell, then expand the disclosure to reveal the split.
  const ruleTable = page.getByRole("table", { name: "Recurring rules" });
  await expect(ruleTable.getByText(PAYEE)).toBeVisible();
  await page.getByRole("button", { name: `Show 1 line for ${PAYEE}` }).click();
  await expect(ruleTable.getByText(ENVELOPE)).toBeVisible();

  // Post due: generates at least one transaction.
  await page.getByRole("button", { name: "Post due" }).click();
  // UX12c — success toasts are also role="status", so scope to this view's post-due notice.
  await expect(page.getByRole("status").filter({ hasText: /Posted/ })).toContainText(
    /Posted \d+ transaction/,
  );

  // Verify the generated transaction appears in the account register.
  await openAccount(page, ACCOUNT);
  const txnList = page.getByRole("list", { name: "Transactions" });
  await expect(txnList.getByRole("listitem").filter({ hasText: PAYEE }).first()).toBeVisible();
});
