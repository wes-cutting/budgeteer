import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Dashboard } from "./Dashboard";
import { makeFakeApi } from "./test/fakeApi";

// The Dashboard renders the UX5 Cockpit (React Router <Link>s) → it needs a router in tests.
function renderDashboard(api: ReturnType<typeof makeFakeApi>) {
  return render(
    <MemoryRouter>
      <Dashboard api={api} />
    </MemoryRouter>,
  );
}

/** Seed an account funded into two envelopes so they have balances to move. */
async function seed(api: ReturnType<typeof makeFakeApi>) {
  const account = await api.createAccount({
    name: "Checking",
    kind: "checking",
    startingBalance: "0",
  });
  const groceries = await api.createEnvelope({ name: "Groceries", kind: "standard" });
  const vacation = await api.createEnvelope({ name: "Vacation", kind: "sinking_fund" });
  await api.createTransaction(account.id, {
    kind: "deposit",
    amount: "1000.00",
    allocations: [
      { envelopeId: groceries.id, amount: "600.00" },
      { envelopeId: vacation.id, amount: "400.00" },
    ],
  });
  return { groceries, vacation };
}

describe("Move money between envelopes (FEAT-007 #7b)", () => {
  test("reallocating updates both envelope balances on the Dashboard", async () => {
    const api = makeFakeApi();
    await seed(api);

    const user = userEvent.setup();
    renderDashboard(api);

    const list = await screen.findByRole("list", { name: "Envelopes list" });
    expect(within(list).getByText("$600.00")).toBeTruthy();
    expect(within(list).getByText("$400.00")).toBeTruthy();

    const form = screen.getByRole("form", { name: "Move money between envelopes" });
    await user.selectOptions(within(form).getByLabelText("From envelope"), "Groceries");
    await user.selectOptions(within(form).getByLabelText("To envelope"), "Vacation");
    await user.clear(within(form).getByLabelText("Amount"));
    await user.type(within(form).getByLabelText("Amount"), "150.00");
    await user.click(within(form).getByRole("button", { name: "Move money" }));

    // Groceries $600 − $150 = $450; Vacation $400 + $150 = $550.
    expect(await within(list).findByText("$450.00")).toBeTruthy();
    expect(await within(list).findByText("$550.00")).toBeTruthy();
  });

  test("a server validation error is surfaced inline", async () => {
    const api = makeFakeApi();
    await seed(api);

    const user = userEvent.setup();
    renderDashboard(api);

    const form = await screen.findByRole("form", { name: "Move money between envelopes" });
    // Same envelope on both sides → client-side guard message.
    await user.selectOptions(within(form).getByLabelText("From envelope"), "Groceries");
    await user.selectOptions(within(form).getByLabelText("To envelope"), "Groceries");
    await user.clear(within(form).getByLabelText("Amount"));
    await user.type(within(form).getByLabelText("Amount"), "10.00");
    await user.click(within(form).getByRole("button", { name: "Move money" }));

    expect(await within(form).findByRole("alert")).toBeTruthy();
  });
});
