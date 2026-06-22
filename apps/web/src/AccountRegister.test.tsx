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

  test("editing a fully-allocated split to a partial shows the remainder (FEAT-005)", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    const rent = await api.createEnvelope({ name: "Rent", kind: "standard" });
    await api.createTransaction(account.id, {
      kind: "deposit",
      amount: "100.00",
      payee: "Employer",
      allocations: [{ envelopeId: rent.id, amount: "100.00" }],
    });

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

    const depositRow = (await screen.findByText("$100.00")).closest("li") as HTMLElement;
    await user.click(within(depositRow).getByRole("button", { name: "Edit split" }));
    await user.click(within(depositRow).getByLabelText("Split"));
    const amount = within(depositRow).getByLabelText("Amount for row 1");
    await user.clear(amount);
    await user.type(amount, "60.00");
    await user.click(within(depositRow).getByRole("button", { name: "Save split" }));

    expect(await screen.findByText(/needs \$40\.00/)).toBeTruthy();
  });

  test("client-side search narrows the register by payee (R8)", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    const rent = await api.createEnvelope({ name: "Rent", kind: "standard" });
    await api.createTransaction(account.id, {
      kind: "deposit",
      amount: "100.00",
      payee: "Paycheck",
      allocations: [{ envelopeId: rent.id, amount: "100.00" }],
    });
    await api.createTransaction(account.id, {
      kind: "withdrawal",
      amount: "30.00",
      payee: "Coffee Shop",
      allocations: [{ envelopeId: rent.id, amount: "30.00" }],
    });

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

    // Both rows present before searching.
    expect(await screen.findByText("Paycheck")).toBeTruthy();
    expect(screen.getByText("Coffee Shop")).toBeTruthy();

    // Searching narrows to the matching payee (case-insensitive).
    await user.type(screen.getByLabelText("Search payee or memo"), "coffee");
    expect(screen.queryByText("Paycheck")).toBeNull();
    expect(screen.getByText("Coffee Shop")).toBeTruthy();
  });

  test("archived envelopes are excluded from the allocation picker (FEAT-006)", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    await api.createEnvelope({ name: "Rent", kind: "standard" });
    const vac = await api.createEnvelope({ name: "Vacation", kind: "sinking_fund" });
    await api.archiveEnvelope(vac.id);

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
    const select = within(form).getByLabelText("Envelope");
    expect(within(select).getByRole("option", { name: "Rent" })).toBeTruthy();
    expect(within(select).queryByRole("option", { name: "Vacation" })).toBeNull();
  });
});
