import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope } from "./setup";

test("envelope ledger: click envelope name → view allocations → back to Dashboard (R15)", async ({
  page,
}) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Checking ${stamp}`;
  const ENVELOPE = `E2E Groceries ${stamp}`;

  await page.goto("/");
  await createAccount(page, ACCOUNT, { balance: "500.00" });
  await createEnvelope(page, ENVELOPE);

  // Open the account register and add a withdrawal allocated to the envelope
  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByLabel("Transaction amount").fill("48.70");
  await txnForm.getByLabel("Payee").fill("Whole Foods");
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();
  await page.getByRole("button", { name: "← Dashboard" }).click();

  // Click the envelope name to open the ledger
  await page
    .getByRole("list", { name: "Envelopes list" })
    .getByRole("button", { name: ENVELOPE })
    .click();

  // Ledger heading and row content are visible
  await expect(page.getByRole("heading", { name: new RegExp(ENVELOPE) })).toBeVisible();
  await expect(page.getByText("Whole Foods")).toBeVisible();
  await expect(page.getByText(ACCOUNT)).toBeVisible();

  // Back button returns to the Dashboard
  await page.getByRole("button", { name: "← Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
});

test("create, archive, and unarchive an envelope", async ({ page }) => {
  const stamp = Date.now();
  const ENVELOPE = `E2E Envelope ${stamp}`;
  await page.goto("/");
  await createEnvelope(page, ENVELOPE);

  const envelopeList = page.getByRole("list", { name: "Envelopes list" });
  const archivedList = page.getByRole("list", { name: "Archived envelopes" });

  // Archive
  await envelopeList
    .getByRole("listitem")
    .filter({ hasText: ENVELOPE })
    .getByRole("button", { name: "Archive" })
    .click();
  await expect(envelopeList.getByText(ENVELOPE)).toHaveCount(0);
  await expect(archivedList.getByText(ENVELOPE)).toBeVisible();

  // Unarchive
  await archivedList
    .getByRole("listitem")
    .filter({ hasText: ENVELOPE })
    .getByRole("button", { name: "Unarchive" })
    .click();
  await expect(envelopeList.getByText(ENVELOPE)).toBeVisible();
  await expect(archivedList.getByText(ENVELOPE)).toHaveCount(0);
});
