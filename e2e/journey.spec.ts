import { expect, test } from "@playwright/test";

// A real browser → real Vite-served web app → real Fastify API round-trip (EH5). Names are stamped
// so the journey is independent of any data already in the (in-process) dev database — it asserts
// only on the rows it creates, never on a global empty state.
const stamp = Date.now();
const ACCOUNT = `E2E Checking ${stamp}`;
const ENVELOPE = `E2E Groceries ${stamp}`;
const PAYEE = `E2E Paycheck ${stamp}`;

test("dashboard loads against the real API, then account → envelope → allocate a deposit", async ({
  page,
}) => {
  await page.goto("/");

  // 1. The dashboard loads AGAINST THE REAL API — the CORS-class check. The heading renders and
  //    the initial GET /accounts + GET /envelopes did NOT fail (no "Couldn't load your data."
  //    alert). A CORS misconfig would surface here exactly as the shipped bug did.
  await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
  await expect(page.getByText("Couldn't load your data.")).toHaveCount(0);

  // 2. Create an account with a $0.00 opening balance (real POST /accounts).
  const accountForm = page.getByRole("form", { name: "Add account" });
  await accountForm.getByLabel("Name", { exact: true }).fill(ACCOUNT);
  await accountForm.getByLabel("Starting balance").fill("0.00");
  await accountForm.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByRole("button", { name: ACCOUNT })).toBeVisible();

  // 3. Create an envelope (real POST /envelopes).
  const envelopeForm = page.getByRole("form", { name: "Add envelope" });
  await envelopeForm.getByLabel("Name", { exact: true }).fill(ENVELOPE);
  await envelopeForm.getByRole("button", { name: "Add envelope" }).click();
  const envelopeList = page.getByRole("list", { name: "Envelopes list" });
  await expect(envelopeList.getByText(ENVELOPE)).toBeVisible();

  // 4. Open the account register and record a $500 deposit fully allocated to the envelope
  //    (real POST /accounts/:id/transactions with one allocation).
  await page.getByRole("button", { name: ACCOUNT }).click();
  await expect(page.getByRole("heading", { name: ACCOUNT, level: 1 })).toBeVisible();

  const txnForm = page.getByRole("form", { name: "Add transaction" });
  await txnForm.getByRole("radio", { name: "Deposit" }).check();
  await txnForm.getByLabel("Transaction amount").fill("500.00");
  await txnForm.getByLabel("Payee").fill(PAYEE);
  await txnForm.getByLabel("Envelope", { exact: true }).selectOption({ label: ENVELOPE });
  await txnForm.getByRole("button", { name: "Save transaction" }).click();

  // The new row shows the deposit fully allocated, and the derived account balance reflects it.
  const txnRow = page
    .getByRole("list", { name: "Transactions" })
    .getByRole("listitem")
    .filter({ hasText: PAYEE });
  await expect(txnRow).toContainText("$500.00");
  await expect(txnRow).toContainText("fully allocated");
  // Exact match: the register header reads "Balance: …", distinct from the ReconcilePanel's
  // "Budgeteer balance: …" line that also shows the derived balance.
  await expect(page.getByText("Balance: $500.00", { exact: true })).toBeVisible();

  // 5. Back on the dashboard, the envelope balance is DERIVED from that allocation — proof the
  //    money landed end to end (data → API → UI), not just that the request returned 2xx.
  await page.getByRole("button", { name: "← Dashboard" }).click();
  const envelopeRow = envelopeList.getByRole("listitem").filter({ hasText: ENVELOPE });
  await expect(envelopeRow).toContainText("$500.00");
});
