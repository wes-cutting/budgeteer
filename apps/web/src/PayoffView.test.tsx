import { describe, expect, test } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayoffView } from "./PayoffView";
import { type Api, ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";

/** A loan account currently owing `owe` dollars (a negative opening balance). */
async function loanOwing(owe: string): Promise<Api> {
  const api = makeFakeApi();
  await api.createAccount({ name: "Car loan", kind: "loan", startingBalance: `-${owe}` });
  return api;
}

const principalForm = () => screen.getByRole("form", { name: "Original principal for Car loan" });

describe("PayoffView (FEAT-014b)", () => {
  test("setting an original principal inline reveals owed, paid-down and payoff, plus a trend", async () => {
    render(<PayoffView api={await loanOwing("7500.00")} />);

    // Before a principal, payoff is unknown (text, not colour) and prompts to set one.
    await screen.findByRole("form", { name: "Original principal for Car loan" });
    expect(screen.getAllByText("— (set an original principal)").length).toBeGreaterThan(0);

    // Set a $10,000 original principal inline → a real PUT round-trip, then reload.
    await userEvent.type(
      within(principalForm()).getByLabelText("Original principal for Car loan"),
      "10000.00",
    );
    await userEvent.click(within(principalForm()).getByRole("button", { name: "Save" }));

    // 1 − 7500/10000 = 25.0% (roll-up + row + trend); paid down 2,500; owed 7,500 — all text.
    expect((await screen.findAllByText("25.0%")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0); // paid down
    expect(screen.getAllByText("$7,500.00").length).toBeGreaterThan(0); // owed
    expect(screen.getByText("Payoff over time — Car loan")).toBeTruthy();
  });

  test("a settled loan (balance 0) reads 100% paid off", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Car loan", kind: "loan", startingBalance: "0" });
    render(<PayoffView api={api} />);
    await screen.findByRole("form", { name: "Original principal for Car loan" });
    await userEvent.type(
      within(principalForm()).getByLabelText("Original principal for Car loan"),
      "10000.00",
    );
    await userEvent.click(within(principalForm()).getByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("100.0%")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$0.00 (paid off)").length).toBeGreaterThan(0);
  });

  test("empty state when there are no loan accounts", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "1000.00" });
    render(<PayoffView api={api} />);
    expect(await screen.findByText(/No loan accounts yet/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("surfaces a load error", async () => {
    const api = makeFakeApi({
      getDebtPayoff: () => Promise.reject(new ApiError("Couldn't reach the server.")),
    });
    render(<PayoffView api={api} />);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Couldn't reach the server."),
    );
  });
});
