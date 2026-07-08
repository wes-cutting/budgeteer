import { expect, test } from "@playwright/test";
import {
  createAccount,
  createEnvelope,
  goToDashboard,
  openAccount,
  openNeeds,
  openQuickAdd,
} from "./setup";

/**
 * UX7 — the global quick-add transaction. PRD journey #1 (the common case) is reachable from the
 * persistent shell nav as a MODAL ROUTE (`/transactions/new`): pick the account, enter the amount,
 * allocate, save, and land back where you were. It fans out to the same `createTransaction` the
 * register uses (no new endpoint), so a partial allocation's remainder still surfaces in
 * needs-allocation. The shared e2e DB accretes data across specs, so we assert robust facts scoped to
 * our uniquely-stamped fixtures, not household-wide absolutes.
 */

test("records a transaction against the picked account and returns you where you were", async ({
  page,
}) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E QuickAdd ${stamp}`;
  const ENVELOPE = `E2E QA Groceries ${stamp}`;
  const PAYEE = `E2E QA Paycheck ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE);

  // Open the modal from the shell nav while standing on the home cockpit.
  await goToDashboard(page);
  await openQuickAdd(page);

  const dialog = page.getByRole("dialog", { name: "Add a transaction" });
  await dialog.getByRole("radio", { name: "Deposit" }).check();
  await dialog.getByLabel("Account").selectOption({ label: ACCOUNT });
  await dialog.getByLabel("Transaction amount").fill("500.00");
  await dialog.getByLabel("Payee").fill(PAYEE);
  await dialog.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE });
  await dialog.getByRole("button", { name: "Save transaction" }).click();

  // The modal closes and we are back on the home cockpit (where we opened it from).
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();

  // The transaction is recorded against the picked account — open its register to confirm.
  await openAccount(page, ACCOUNT);
  const txnRow = page
    .getByRole("list", { name: "Transactions" })
    .getByRole("listitem")
    .filter({ hasText: PAYEE });
  await expect(txnRow).toContainText("$500.00");
  await expect(txnRow).toContainText("fully allocated");
  await expect(page.getByText("Balance: $500.00", { exact: true })).toBeVisible();
});

test("a partial allocation entered globally surfaces in needs-allocation", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E QA Partial ${stamp}`;
  const PAYEE = `E2E QA Unalloc ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);

  await goToDashboard(page);
  await openQuickAdd(page);
  const dialog = page.getByRole("dialog", { name: "Add a transaction" });
  await dialog.getByRole("radio", { name: "Deposit" }).check();
  await dialog.getByLabel("Account").selectOption({ label: ACCOUNT });
  await dialog.getByLabel("Transaction amount").fill("200.00");
  await dialog.getByLabel("Payee").fill(PAYEE);
  // Split mode with no rows filled → the whole $200 is left unallocated (partial allocation allowed).
  await dialog.getByRole("radio", { name: "Split" }).check();
  await dialog.getByRole("button", { name: "Save transaction" }).click();
  await expect(dialog).toBeHidden();

  // The unallocated remainder shows up in the Needs-allocation surface.
  await openNeeds(page);
  await expect(page.getByRole("list", { name: "Needs allocation" }).getByText(PAYEE)).toBeVisible();
});

test("Escape closes the modal without recording anything", async ({ page }) => {
  await page.goto("/");
  await goToDashboard(page);
  await openQuickAdd(page);
  const dialog = page.getByRole("dialog", { name: "Add a transaction" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
});
