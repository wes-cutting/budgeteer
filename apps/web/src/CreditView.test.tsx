import { describe, expect, test } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreditView } from "./CreditView";
import { type Api, ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";

/** A credit account already owing `owe` dollars (a negative opening balance). */
async function cardOwing(owe: string): Promise<Api> {
  const api = makeFakeApi();
  await api.createAccount({ name: "Visa", kind: "credit", startingBalance: `-${owe}` });
  return api;
}

const limitForm = () => screen.getByRole("form", { name: "Credit limit for Visa" });

describe("CreditView (FEAT-014a)", () => {
  test("setting a credit limit inline reveals owed, available and utilization, plus a trend", async () => {
    render(<CreditView api={await cardOwing("1500.00")} />);

    // Before a limit, utilization is unknown (text, not colour) and prompts to set one.
    await screen.findByRole("form", { name: "Credit limit for Visa" });
    expect(screen.getAllByText("— (set a limit)").length).toBeGreaterThan(0);

    // Set a $5,000 limit inline → a real PUT round-trip, then reload.
    await userEvent.type(within(limitForm()).getByLabelText("Credit limit for Visa"), "5000.00");
    await userEvent.click(within(limitForm()).getByRole("button", { name: "Save" }));

    // 1500 / 5000 = 30.0% (roll-up + row + trend); available 3,500; owed 1,500 — all shown as text.
    expect((await screen.findAllByText("30.0%")).length).toBeGreaterThan(0);
    expect(screen.getByText("$3,500.00")).toBeTruthy(); // available (row only)
    expect(screen.getAllByText("$1,500.00").length).toBeGreaterThan(0);
    // The trend table is rendered for the account.
    expect(screen.getByText("Utilization over time — Visa")).toBeTruthy();
  });

  test("over-limit reads above 100% as text ('over limit'), not clamped", async () => {
    const api = await cardOwing("6000.00");
    render(<CreditView api={api} />);
    await screen.findByRole("form", { name: "Credit limit for Visa" });
    await userEvent.type(within(limitForm()).getByLabelText("Credit limit for Visa"), "5000.00");
    await userEvent.click(within(limitForm()).getByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("120.0% over limit")).length).toBeGreaterThan(0);
  });

  test("empty state when there are no credit accounts", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "1000.00" });
    render(<CreditView api={api} />);
    expect(await screen.findByText(/No credit accounts yet/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("surfaces a load error", async () => {
    const api = makeFakeApi({
      getCreditUtilization: () => Promise.reject(new ApiError("Couldn't reach the server.")),
    });
    render(<CreditView api={api} />);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Couldn't reach the server."),
    );
  });
});
