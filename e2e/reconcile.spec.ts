import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope, openAccount } from "./setup";

async function fundAccount(
  page: Parameters<typeof createAccount>[0],
  account: string,
  envelope: string,
  payee: string,
) {
  await openAccount(page, account);
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("500.00");
  await txnForm.getByLabel("Payee").fill(payee);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: envelope });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  await page.getByText("Balance: $500.00", { exact: true });
}

test("reconcile to bank — balance matches", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Groceries ${stamp}`;
  const PAYEE = `E2E Paycheck ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE);
  await fundAccount(page, ACCOUNT, ENVELOPE, PAYEE);

  // Reconcile with the exact balance.
  const reconcileForm = page.getByRole("form", { name: "Reconcile" });
  await reconcileForm.getByLabel("Bank balance").fill("500.00");
  await reconcileForm.getByRole("button", { name: "Record reconciliation" }).click();
  // UX12c — success toasts are also role="status" live regions, so scope to this view's notice.
  await expect(page.getByRole("status").filter({ hasText: "Reconciled" })).toContainText(
    "Reconciled — matches your bank.",
  );

  // Reconciliation history shows the recorded entry.
  await expect(page.getByText("Last reconciled")).toBeVisible();
  await expect(page.getByText("(matched)")).toBeVisible();
});

test("reconcile to bank — mismatched balance shows the difference", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Groceries ${stamp}`;
  const PAYEE = `E2E Paycheck ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE);
  await fundAccount(page, ACCOUNT, ENVELOPE, PAYEE);

  // Reconcile with a $10 discrepancy (bank says $510, Budgeteer says $500).
  const reconcileForm = page.getByRole("form", { name: "Reconcile" });
  await reconcileForm.getByLabel("Bank balance").fill("510.00");
  await reconcileForm.getByRole("button", { name: "Record reconciliation" }).click();
  // UX12c — scope past the toast's role="status" announce region to this view's notice.
  await expect(page.getByRole("status").filter({ hasText: "Recorded" })).toContainText(
    "Recorded — off by $10.00.",
  );
  // History paragraph also records the discrepancy.
  await expect(page.getByText("Last reconciled")).toBeVisible();
  await expect(page.getByText(/off by \$10\.00/).first()).toBeVisible();
});
