import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountRegister } from "./AccountRegister";
import { makeFakeApi } from "./test/fakeApi";

/** A $70 withdrawal split as $100 spend on Groceries + a $30 refund row on Gas (net −$70). */
describe("Refund row within a split (FEAT-008)", () => {
  test("a refund row nets to the amount, saves, and credits the envelope back", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    const groceries = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    const gas = await api.createEnvelope({ name: "Gas", kind: "standard" });

    const user = userEvent.setup();
    render(
      <AccountRegister
        api={api}
        accountId={account.id}
        accountName="Checking"
        onBack={() => {}}
        onOpenNeeds={() => {}}
      />,
    );

    await screen.findByText("Transactions");
    const form = screen.getByRole("form", { name: "Add transaction" });
    await user.type(within(form).getByLabelText("Transaction amount"), "70.00"); // withdrawal default
    await user.click(within(form).getByLabelText("Split"));

    // Row 1: $100 spent on Groceries.
    await user.selectOptions(within(form).getByLabelText("Envelope for row 1"), groceries.id);
    await user.type(within(form).getByLabelText("Amount for row 1"), "100.00");
    // Add row 2: $30 refunded to Gas.
    await user.click(within(form).getByRole("button", { name: "Add row" }));
    await user.selectOptions(within(form).getByLabelText("Envelope for row 2"), gas.id);
    await user.type(within(form).getByLabelText("Amount for row 2"), "30.00");
    await user.click(within(form).getByLabelText("Refund for row 2"));

    // Net = −100 + 30 = −70 → fully allocated, save enabled.
    expect(await within(form).findByText(/Remaining \$0\.00/)).toBeTruthy();
    const save = within(form).getByRole("button", { name: "Save transaction" });
    expect(save.hasAttribute("disabled")).toBe(false);
    await user.click(save);

    // Account dropped by $70; Gas got credited back +$30; Groceries spent −$100.
    expect(await screen.findByText(/Balance: -\$70\.00/)).toBeTruthy();
    const envelopes = await api.listEnvelopes();
    expect(envelopes.find((e) => e.id === gas.id)?.balanceCents).toBe(3000);
    expect(envelopes.find((e) => e.id === groceries.id)?.balanceCents).toBe(-10000);
  });

  test("a refund row that flips the net direction disables Save", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    const groceries = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    const gas = await api.createEnvelope({ name: "Gas", kind: "standard" });

    const user = userEvent.setup();
    render(
      <AccountRegister
        api={api}
        accountId={account.id}
        accountName="Checking"
        onBack={() => {}}
        onOpenNeeds={() => {}}
      />,
    );

    await screen.findByText("Transactions");
    const form = screen.getByRole("form", { name: "Add transaction" });
    await user.type(within(form).getByLabelText("Transaction amount"), "70.00");
    await user.click(within(form).getByLabelText("Split"));
    await user.selectOptions(within(form).getByLabelText("Envelope for row 1"), groceries.id);
    await user.type(within(form).getByLabelText("Amount for row 1"), "50.00");
    await user.click(within(form).getByRole("button", { name: "Add row" }));
    await user.selectOptions(within(form).getByLabelText("Envelope for row 2"), gas.id);
    await user.type(within(form).getByLabelText("Amount for row 2"), "60.00");
    await user.click(within(form).getByLabelText("Refund for row 2")); // net −50 + 60 = +10

    expect(await within(form).findByText(/Refunds exceed the amount/)).toBeTruthy();
    expect(
      within(form).getByRole("button", { name: "Save transaction" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
