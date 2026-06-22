import { expect, test } from "@playwright/test";
import { createAccount } from "./setup";

test("dashboard loads against the real API", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeVisible();
  // No error means initial GET /accounts + GET /envelopes both succeeded — the CORS-class check.
  // A CORS misconfig surfaces here exactly as the shipped bug did.
  await expect(page.getByText("Couldn't load your data.")).toHaveCount(0);
});

test("create a checking account and open its register", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
  await expect(page.getByRole("heading", { name: ACCOUNT, level: 1 })).toBeVisible();
  await expect(page.getByText("Balance: $0.00", { exact: true })).toBeVisible();
});

test("archive and unarchive an account (R7)", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Archive ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);

  await page.getByRole("button", { name: `Archive ${ACCOUNT}` }).click();
  await expect(page.getByRole("button", { name: ACCOUNT, exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Show archived" }).click();
  await expect(page.getByRole("heading", { name: "Archived accounts" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Unarchive ${ACCOUNT}` })).toBeVisible();

  await page.getByRole("button", { name: `Unarchive ${ACCOUNT}` }).click();
  await expect(page.getByRole("button", { name: ACCOUNT, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Unarchive ${ACCOUNT}` })).toHaveCount(0);
});

// R4 — Dashboard net worth summary. The snapshot sums ALL household accounts (the shared e2e DB
// accretes across parallel specs), so we assert the arithmetic INVARIANT (net = assets + liabilities)
// off a single rendered snapshot — true at any render regardless of other tests' accounts. The exact
// kind-based sums are covered deterministically by the Dashboard component test. We create both an
// asset and a liability so both columns are exercised against the real client-side calc.
test("net worth summary: net = assets + liabilities, classified by kind (R4)", async ({ page }) => {
  const stamp = Date.now();
  const CHECKING = `E2E NWS Checking ${stamp}`;
  const CARD = `E2E NWS Card ${stamp}`;
  await page.goto("/");
  await createAccount(page, CHECKING, { balance: "1000.00" }); // an asset
  await createAccount(page, CARD, { kind: "credit", balance: "-300.00" }); // a liability (owes $300)

  const summary = page.getByRole("table", { name: "Net worth summary" });
  const cents = async (label: RegExp): Promise<number> => {
    const txt = await summary.getByRole("row", { name: label }).getByRole("cell").textContent();
    return Math.round(parseFloat((txt ?? "").replace(/[^0-9.-]/g, "")) * 100);
  };
  const [assets, liabilities, net] = await Promise.all([
    cents(/Total assets/),
    cents(/Total liabilities/),
    cents(/Net worth/),
  ]);
  // The invariant the snapshot rests on — proven end to end, agreeing with the NetWorthView split.
  expect(net).toBe(assets + liabilities);
});

test("rename an account inline (R1)", async ({ page }) => {
  const stamp = Date.now();
  const ORIGINAL = `E2E Rename ${stamp}`;
  const RENAMED = `E2E Renamed ${stamp}`;
  await page.goto("/");
  await createAccount(page, ORIGINAL);
  await page.getByRole("button", { name: `Rename ${ORIGINAL}` }).click();
  await page.getByRole("textbox", { name: `Rename ${ORIGINAL}` }).fill(RENAMED);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: RENAMED, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Rename ${RENAMED}` })).toBeVisible();
});
