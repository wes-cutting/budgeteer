import { expect, test } from "@playwright/test";
import { createEnvelope } from "./setup";

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
