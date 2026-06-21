import { expect, test } from "@playwright/test";
import { createAccount, createEnvelope } from "./setup";

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

  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
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

  await page.getByRole("button", { name: "Templates" }).click();
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();

  // Create a template with one line.
  await page.getByLabel("Template name").fill(TEMPLATE);
  await page.getByLabel("Template envelope 1").selectOption({ label: ENVELOPE });
  await page.getByLabel("Template amount 1").fill("250.00");
  await page.getByRole("button", { name: "Save template" }).click();

  // Template appears in the list.
  const templateList = page.getByRole("list", { name: "Templates" });
  const templateRow = templateList.getByRole("listitem").filter({ hasText: TEMPLATE });
  await expect(templateRow).toBeVisible();
  await expect(templateRow).toContainText("1 lines");

  // Rename it.
  await templateList
    .getByRole("listitem")
    .filter({ hasText: TEMPLATE })
    .getByRole("button", { name: "Rename" })
    .click();
  await page.getByLabel(`Rename ${TEMPLATE}`).fill(TEMPLATE_NEW);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(templateList.getByText(TEMPLATE_NEW)).toBeVisible();
  await expect(templateList.getByText(TEMPLATE)).toHaveCount(0);
});
