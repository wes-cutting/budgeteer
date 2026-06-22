import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope, goToDashboard, openAnalysis } from "./setup";

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

test("envelope target set in the Budget view shows inline on the Dashboard row (R5)", async ({
  page,
}) => {
  const stamp = Date.now();
  const ENVELOPE = `E2E Budgeted ${stamp}`;

  await page.goto("/");
  await createEnvelope(page, ENVELOPE);

  // Set a monthly target on this envelope in the Budget vs. Actual analysis view.
  await openAnalysis(page, "Budget");
  const targetForm = page.getByRole("form", { name: `Target for ${ENVELOPE}` });
  await targetForm.getByLabel(`Monthly target for ${ENVELOPE}`).fill("200.00");
  await targetForm.getByRole("button", { name: "Save" }).click();
  // The Clear button only appears once a target is set — wait for the save to land.
  await expect(targetForm.getByRole("button", { name: "Clear" })).toBeVisible();

  // Back on the Dashboard, the target shows inline on the envelope's row (no spend yet → remaining = target).
  await goToDashboard(page);
  const row = page
    .getByRole("list", { name: "Envelopes list" })
    .getByRole("listitem")
    .filter({ hasText: ENVELOPE });
  await expect(row).toContainText("Target: $200.00");
  await expect(row).toContainText("Remaining: $200.00");
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
