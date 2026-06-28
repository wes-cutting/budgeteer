import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveMoneyForm } from "./MoveMoneyForm";
import { type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";

// UX6 — Move-money is now the cross-cutting tool on `/manage`; it takes the envelope list + an
// onMoved callback as props, so it is unit-tested directly (no router needed — it renders no Links).

/** Seed an account funded into two envelopes so they have balances to move. */
async function seed(api: Api) {
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
}

describe("Move money between envelopes (FEAT-007 #7b)", () => {
  test("reallocating moves the balance and calls onMoved", async () => {
    const api = makeFakeApi();
    await seed(api);
    const envelopes = await api.listEnvelopes();
    const onMoved = vi.fn();

    const user = userEvent.setup();
    render(<MoveMoneyForm api={api} envelopes={envelopes} onMoved={onMoved} />);

    const form = screen.getByRole("form", { name: "Move money between envelopes" });
    await user.selectOptions(within(form).getByLabelText("From envelope"), "Groceries");
    await user.selectOptions(within(form).getByLabelText("To envelope"), "Vacation");
    await user.clear(within(form).getByLabelText("Amount"));
    await user.type(within(form).getByLabelText("Amount"), "150.00");
    await user.click(within(form).getByRole("button", { name: "Move money" }));

    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    // Groceries $600 − $150 = $450; Vacation $400 + $150 = $550 (derived from the reallocation).
    const after = await api.listEnvelopes();
    expect(after.find((e) => e.name === "Groceries")?.balanceCents).toBe(45000);
    expect(after.find((e) => e.name === "Vacation")?.balanceCents).toBe(55000);
  });

  test("a client-side validation error is surfaced inline", async () => {
    const api = makeFakeApi();
    await seed(api);
    const envelopes = await api.listEnvelopes();

    const user = userEvent.setup();
    render(<MoveMoneyForm api={api} envelopes={envelopes} onMoved={() => {}} />);

    const form = screen.getByRole("form", { name: "Move money between envelopes" });
    // Same envelope on both sides → client-side guard message.
    await user.selectOptions(within(form).getByLabelText("From envelope"), "Groceries");
    await user.selectOptions(within(form).getByLabelText("To envelope"), "Groceries");
    await user.clear(within(form).getByLabelText("Amount"));
    await user.type(within(form).getByLabelText("Amount"), "10.00");
    await user.click(within(form).getByRole("button", { name: "Move money" }));

    expect(await within(form).findByRole("alert")).toBeTruthy();
  });
});
