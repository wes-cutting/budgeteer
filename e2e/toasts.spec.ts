import { expect, test } from "@playwright/test";
import { createAccount } from "./setup";

// UX12c — success toasts (feedback-on-mutation). Every successful mutation was previously silent; a
// transient Radix Toast now confirms it. This drives the behaviour end-to-end against the real API:
// the toast appears after a create, and its Dismiss affordance removes it.
test("a success toast confirms a create and can be dismissed (UX12c)", async ({ page }) => {
  const stamp = Date.now();
  const ACCOUNT = `E2E Toast ${stamp}`;
  await page.goto("/");
  // `keepToast` because createAccount now clears the notifications region on the way out — a toast
  // is fixed-position over the page for 5s and was intercepting the next click in other specs. This
  // spec is the one caller that owns the toast, so it opts out and asserts the untouched behaviour.
  await createAccount(page, ACCOUNT, { keepToast: true }); // leaves us on /accounts, account created

  // The success toast is announced in the notifications region…
  const region = page.getByRole("region", { name: "Notifications" });
  await expect(region.getByText("Account created")).toBeVisible();

  // …and the explicit Dismiss affordance clears it (no need to wait for the 5s auto-dismiss).
  await region.getByRole("button", { name: "Dismiss" }).click();
  await expect(region.getByText("Account created")).toHaveCount(0);
});
