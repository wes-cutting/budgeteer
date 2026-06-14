import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountRegister } from "./AccountRegister";
import { makeFakeApi } from "./test/fakeApi";

describe("AccountRegister (add transaction → allocate)", () => {
  test("a withdrawal allocated to one envelope appears fully allocated and updates the balance", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "200.00",
    });
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
    await user.type(within(form).getByLabelText("Transaction amount"), "48.20"); // withdrawal is default
    await user.selectOptions(within(form).getByLabelText("Envelope"), gas.id); // single mode
    await user.click(within(form).getByRole("button", { name: "Save transaction" }));

    expect(await screen.findByText("-$48.20")).toBeTruthy();
    expect(await screen.findByText("fully allocated")).toBeTruthy();
    expect(await screen.findByText(/Balance: \$151\.80/)).toBeTruthy();
  });
});
