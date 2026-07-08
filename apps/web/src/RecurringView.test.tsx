import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurringView } from "./RecurringView";
import { localToday } from "./dates";
import { makeFakeApi } from "./test/fakeApi";

// Local-calendar offsets (EH8): the fake derives due-ness from the user's LOCAL today, so the
// fixtures must be local too — a UTC offset would drift a day from evening on west of UTC.
const isoOffset = (days: number): string => {
  const [y, m, d] = localToday().split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + days);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

describe("RecurringView (FEAT-009)", () => {
  test("create a rule, post due to generate transactions, then delete it", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "0" });
    const pay = await api.createEnvelope({ name: "Paycheck", kind: "standard" });

    const user = userEvent.setup();
    render(<RecurringView api={api} />);

    // Fill the rule: a weekly deposit anchored 14 days ago (→ 3 occurrences due).
    const form = await screen.findByRole("form", { name: "New recurring rule" });
    await user.click(within(form).getByLabelText("Deposit"));
    await user.type(within(form).getByLabelText("Amount"), "10.00");
    await user.selectOptions(within(form).getByLabelText("Frequency"), "weekly");
    await user.clear(within(form).getByLabelText("First date"));
    await user.type(within(form).getByLabelText("First date"), isoOffset(-14));

    // Define the split in the editor and create the rule.
    await user.selectOptions(screen.getByLabelText("Envelope"), pay.id);
    await user.click(screen.getByRole("button", { name: "Create recurring rule" }));

    // UXR5 — the rules list is now a table: account, frequency, and the due-status pair render as
    // cells (the split moved behind a per-row disclosure).
    const table = await screen.findByRole("table", { name: "Recurring rules" });
    expect(within(table).getByText("Checking")).toBeTruthy();
    expect(within(table).getByText("weekly")).toBeTruthy();
    expect(within(table).getByText("3 due")).toBeTruthy(); // −14, −7, today

    // Post due → 3 transactions generated.
    await user.click(screen.getByRole("button", { name: "Post due" }));
    expect(await screen.findByText("Posted 3 transactions.")).toBeTruthy();
    expect(
      within(await screen.findByRole("table", { name: "Recurring rules" })).getByText("Up to date"),
    ).toBeTruthy();

    // Posting again does nothing (idempotent).
    await user.click(screen.getByRole("button", { name: "Post due" }));
    expect(await screen.findByText("Nothing due right now.")).toBeTruthy();

    // Delete the rule — now behind the UX12 confirm dialog (§4). The row has no payee, so its
    // per-row action name falls back to the account ("Delete Checking").
    await user.click(
      within(screen.getByRole("table", { name: "Recurring rules" })).getByRole("button", {
        name: "Delete Checking",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Delete this rule?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/No recurring rules yet/)).toBeTruthy();
  });
});
