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

  // 6. Budget vs. actual (FEAT-012): set a monthly target via the inline editor — a real
  //    cross-origin PUT /envelopes/:id/target. This guards the CORS allow-methods fix:
  //    @fastify/cors defaults the preflight to GET,HEAD,POST, which silently blocks browser
  //    PUT/PATCH/DELETE (the class of bug the prior POST-only journey could not catch).
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis — budget vs. actual", level: 1 }),
  ).toBeVisible();
  const budgetRow = page.getByRole("row").filter({ hasText: ENVELOPE });
  await budgetRow.getByLabel(`Monthly target for ${ENVELOPE}`).fill("200.00");
  await budgetRow.getByRole("button", { name: "Save" }).click();
  // The PUT round-tripped: the target persisted and, since the deposit FUNDED (not spent) the
  // envelope, spend is $0 and the full target remains — and a Clear control now exists.
  await expect(budgetRow).toContainText("$0.00"); // spent (outflow only — funding excluded)
  await expect(budgetRow).toContainText("$200.00"); // remaining = target − spent
  await expect(budgetRow.getByRole("button", { name: "Clear" })).toBeVisible();

  // 7. Cash-flow forecast (FEAT-013): the forward projection renders against the real API. With the
  //    $200 target just set (and no scheduled rules on this account), the default-on expected-spend
  //    appears, projected from the derived $500 starting balance — proving the targets → forecast
  //    read wires through end to end (data → API → UI), not just that the GET returned 2xx.
  await page.getByRole("button", { name: "← Dashboard" }).click();
  await page.getByRole("button", { name: "Forecast", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis — cash-flow forecast", level: 1 }),
  ).toBeVisible();
  await page.getByLabel("Account").selectOption({ label: ACCOUNT });
  await expect(page.getByText("$500.00").first()).toBeVisible(); // derived starting balance
  await expect(page.getByText("Expected discretionary spend").first()).toBeVisible();
});
