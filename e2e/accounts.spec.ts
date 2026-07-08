import { expect, test } from "@playwright/test";
import { createAccount, goToManage } from "./setup";

test("the account and envelope lists load against the real API", async ({ page }) => {
  // UX6 — the home is the cockpit; the account/envelope reads live on their list routes now. This is
  // the CORS-class check: a CORS misconfig on GET /accounts or /envelopes surfaces here as it did
  // for the shipped bug.
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Accounts", level: 1 })).toBeVisible();
  await expect(page.getByText("Couldn't load your accounts.")).toHaveCount(0);
  await page.goto("/envelopes");
  await expect(page.getByRole("heading", { name: "Envelopes", level: 1 })).toBeVisible();
  await expect(page.getByText("Couldn't load your envelopes.")).toHaveCount(0);
});

test("create a checking account and open its register", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Account ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  // The account name is now a <Link> on the /accounts list (UX6 — was a button).
  await page
    .getByRole("list", { name: "Accounts list" })
    .getByRole("link", { name: ACCOUNT, exact: true })
    .click();
  await expect(page.getByRole("heading", { name: ACCOUNT, level: 1 })).toBeVisible();
  await expect(page.getByText("Balance: $0.00", { exact: true })).toBeVisible();
});

test("inline validation (UX12d): an un-parseable starting balance blocks the create until fixed", async ({
  page,
}) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Inline ${stamp}`;
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Add account" }).click();
  const form = page.getByRole("form", { name: "Add account" });
  await form.getByLabel("Name", { exact: true }).fill(ACCOUNT);
  const balance = form.getByLabel("Starting balance");
  await balance.fill("12,00"); // not a valid amount
  await balance.blur();

  // The field surfaces its own error and the create is blocked — no account link appears.
  await expect(form.getByText("Enter an amount like 12.34.")).toBeVisible();
  await expect(balance).toHaveAttribute("aria-invalid", "true");
  await form.getByRole("button", { name: "Add account" }).click();
  await expect(
    page.getByRole("list", { name: "Accounts list" }).getByRole("link", { name: ACCOUNT }),
  ).toHaveCount(0);

  // Correcting it clears the error live and the account is created.
  await balance.fill("2140.00");
  await expect(form.getByText("Enter an amount like 12.34.")).toHaveCount(0);
  await form.getByRole("button", { name: "Add account" }).click();
  await expect(
    page.getByRole("list", { name: "Accounts list" }).getByRole("link", { name: ACCOUNT }),
  ).toBeVisible();
});

test("archive and unarchive an account (R7)", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Archive ${stamp}`;
  await page.goto("/");
  await createAccount(page, ACCOUNT);
  const list = page.getByRole("list", { name: "Accounts list" });

  // UX12 — archiving confirms first in a dialog.
  await page.getByRole("button", { name: `Archive ${ACCOUNT}` }).click();
  const archiveDialog = page.getByRole("dialog", { name: "Archive account?" });
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(archiveDialog).toBeHidden();
  await expect(list.getByRole("link", { name: ACCOUNT, exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Show archived" }).click();
  await expect(page.getByRole("heading", { name: "Archived accounts" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Unarchive ${ACCOUNT}` })).toBeVisible();

  await page.getByRole("button", { name: `Unarchive ${ACCOUNT}` }).click();
  await expect(list.getByRole("link", { name: ACCOUNT, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Unarchive ${ACCOUNT}` })).toHaveCount(0);
});

// R4 — net worth summary, relocated to /manage (UX6). The snapshot sums ALL household accounts (the
// shared e2e DB accretes across parallel specs), so we assert the arithmetic INVARIANT (net = assets
// + liabilities) off a single rendered snapshot — true at any render regardless of other tests'
// accounts. The exact kind-based sums are covered deterministically by the ManageView component test.
test("net worth summary: net = assets + liabilities, classified by kind (R4)", async ({ page }) => {
  const stamp = Date.now();
  const CHECKING = `E2E NWS Checking ${stamp}`;
  const CARD = `E2E NWS Card ${stamp}`;
  await page.goto("/");
  await createAccount(page, CHECKING, { balance: "1000.00" }); // an asset
  await createAccount(page, CARD, { kind: "credit", balance: "-300.00" }); // a liability (owes $300)

  await goToManage(page);
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
  const list = page.getByRole("list", { name: "Accounts list" });
  await page.getByRole("button", { name: `Rename ${ORIGINAL}` }).click();
  await page.getByRole("textbox", { name: `Rename ${ORIGINAL}` }).fill(RENAMED);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(list.getByRole("link", { name: RENAMED, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Rename ${RENAMED}` })).toBeVisible();
});
