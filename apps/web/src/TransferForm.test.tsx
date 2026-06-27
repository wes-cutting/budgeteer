import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountRegister } from "./AccountRegister";
import { makeFakeApi } from "./test/fakeApi";

describe("Transfer money (FEAT-007)", () => {
  test("transferring out moves the balance and shows a labeled transfer leg in the register", async () => {
    const api = makeFakeApi();
    const checking = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "500.00",
    });
    await api.createAccount({ name: "Savings", kind: "savings", startingBalance: "0" });

    const user = userEvent.setup();
    render(<AccountRegister api={api} accountId={checking.id} accountName="Checking" />);

    await screen.findByText("Transactions");
    const form = screen.getByRole("form", { name: "Transfer money" });
    await user.selectOptions(within(form).getByLabelText("To account"), "Savings");
    await user.clear(within(form).getByLabelText("Amount"));
    await user.type(within(form).getByLabelText("Amount"), "100.00");
    await user.click(within(form).getByRole("button", { name: "Transfer" }));

    // The register shows the labeled transfer leg and the new account balance.
    expect(await screen.findByText("Transfer to Savings")).toBeTruthy();
    expect(await screen.findByText("-$100.00")).toBeTruthy();
    expect(await screen.findByText(/Balance: \$400\.00/)).toBeTruthy();

    // A transfer leg carries no allocation status (it's already-budgeted money).
    const leg = (await screen.findByText("Transfer to Savings")).closest("li") as HTMLElement;
    expect(within(leg).queryByText("fully allocated")).toBeNull();
    expect(within(leg).queryByRole("button", { name: "Edit split" })).toBeNull();
  });

  test("the source account is not offered as a transfer destination", async () => {
    const api = makeFakeApi();
    const checking = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "100.00",
    });
    await api.createAccount({ name: "Savings", kind: "savings", startingBalance: "0" });

    render(<AccountRegister api={api} accountId={checking.id} accountName="Checking" />);
    await screen.findByText("Transactions");
    const select = within(screen.getByRole("form", { name: "Transfer money" })).getByLabelText(
      "To account",
    );
    expect(within(select).getByRole("option", { name: "Savings" })).toBeTruthy();
    expect(within(select).queryByRole("option", { name: "Checking" })).toBeNull();
  });
});
