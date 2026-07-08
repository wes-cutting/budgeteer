import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope, openAccount, openTemplates } from "./setup";

test("save a split as a template, then apply it to a second transaction", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  const ENVELOPE = `E2E Groceries ${stamp}`;
  const TEMPLATE = `E2E Template ${stamp}`;
  const PAYEE1 = `E2E Paycheck ${stamp}`;
  const PAYEE2 = `E2E Paycheck2 ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await createEnvelope(page, ENVELOPE);

  await openAccount(page, ACCOUNT);
  const txnForm = page.getByRole("form", { name: "Add transaction" });

  // First transaction: $500 deposit in split mode → save as template.
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("500.00");
  await txnForm.getByLabel("Payee").fill(PAYEE1);
  await page.getByRole("radio", { name: "Split" }).check();
  await page.getByLabel("Envelope for row 1").selectOption({ label: ENVELOPE });
  await page.getByLabel("Amount for row 1").fill("500.00");
  await page.getByLabel("New template name").fill(TEMPLATE);
  await page.getByRole("button", { name: "Save as template" }).click();
  await page.getByRole("button", { name: "Save transaction" }).click();

  const txnList = page.getByRole("list", { name: "Transactions" });
  await expect(txnList.getByRole("listitem").filter({ hasText: PAYEE1 })).toContainText(
    "fully allocated",
  );

  // Second transaction: apply the saved template → pre-fills $500 to ENVELOPE.
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("500.00");
  await txnForm.getByLabel("Payee").fill(PAYEE2);
  // The template select appears in split mode; switch there first.
  await page.getByRole("radio", { name: "Split" }).check();
  await page.getByLabel("Apply template").selectOption({ label: TEMPLATE });

  // Template pre-fills row 1 with $500; the allocation is complete.
  await expect(page.getByLabel("Amount for row 1")).toHaveValue("500.00");

  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(txnList.getByRole("listitem").filter({ hasText: PAYEE2 })).toContainText(
    "fully allocated",
  );
});

test("create a template directly in the Templates view, then rename it", async ({ page }) => {
  const stamp = Date.now();
  const ENVELOPE = `E2E Groceries ${stamp}`;
  const TEMPLATE = `E2E Template ${stamp}`;
  const TEMPLATE_NEW = `E2E Template Renamed ${stamp}`;
  await page.goto("/");
  await createEnvelope(page, ENVELOPE);

  await openTemplates(page);
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();

  // Create a template with one line — the Name field is the UXR4 `Field` primitive. `exact` so
  // "Name" doesn't substring-match the "Rename {template}" action buttons (Playwright getByLabel).
  await page.getByLabel("Name", { exact: true }).fill(TEMPLATE);
  await page.getByLabel("Template envelope 1").selectOption({ label: ENVELOPE });
  await page.getByLabel("Template amount 1").fill("250.00");
  await page.getByRole("button", { name: "Save template" }).click();

  // Template appears as a row in the UXR4 saved-templates table (Name · Lines · Total · Actions).
  const templateTable = page.getByRole("table", { name: "Templates" });
  const templateRow = templateTable.getByRole("row").filter({ hasText: TEMPLATE });
  await expect(templateRow).toBeVisible();
  // `exact` — the Lines cell is "1"; without it the Actions cell (its Rename/Delete labels carry the
  // stamped template name, digits and all) substring-matches "1" too.
  await expect(templateRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();

  // Rename it (per-row accessible name, UXR3 table treatment). Target the input by `textbox` role —
  // the Rename button carries the same "Rename {name}" accessible name, so getByLabel would be
  // ambiguous (mirrors accounts.spec's inline-rename convention).
  await templateRow.getByRole("button", { name: `Rename ${TEMPLATE}` }).click();
  await page.getByRole("textbox", { name: `Rename ${TEMPLATE}` }).fill(TEMPLATE_NEW);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(templateTable.getByText(TEMPLATE_NEW)).toBeVisible();
  await expect(templateTable.getByText(TEMPLATE)).toHaveCount(0);

  // Delete it — UX12 confirms first (delete is irreversible for templates).
  await templateTable
    .getByRole("row")
    .filter({ hasText: TEMPLATE_NEW })
    .getByRole("button", { name: `Delete ${TEMPLATE_NEW}` })
    .click();
  const deleteDialog = page.getByRole("dialog", { name: "Delete template?" });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(templateTable.getByText(TEMPLATE_NEW)).toHaveCount(0);
});
