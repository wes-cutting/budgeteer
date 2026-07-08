import { describe, expect, test } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastView } from "./ForecastView";
import { type Api, ApiError } from "./api";
import { localToday } from "./dates";
import { makeFakeApi } from "./test/fakeApi";

// Anchor rules relative to the user's LOCAL today (EH8) — the fake and httpApi both derive it
// locally, so UTC-derived fixtures would drift a day from evening on west of UTC.
const TODAY = localToday();
const plus = (n: number): string => {
  const [y, m, d] = TODAY.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + n);
  const pad = (x: number): string => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
const rowByDate = (date: string): HTMLElement =>
  screen.getByRole("rowheader", { name: date }).closest("tr") as HTMLElement;

/** $1,000 checking; rent −$1,500 at +5 days, paycheck +$2,000 at +10 days (monthly). No targets. */
async function seededScheduled(): Promise<Api> {
  const api = makeFakeApi();
  const acct = await api.createAccount({
    name: "Checking",
    kind: "checking",
    startingBalance: "1000.00",
  });
  const rent = await api.createEnvelope({ name: "Rent", kind: "standard" });
  const salary = await api.createEnvelope({ name: "Salary", kind: "standard" });
  await api.createRecurring({
    accountId: acct.id,
    kind: "withdrawal",
    amount: "1500.00",
    payee: "Rent",
    frequency: "monthly",
    anchorOn: plus(5),
    lines: [{ envelopeId: rent.id, amount: "1500.00" }],
  });
  await api.createRecurring({
    accountId: acct.id,
    kind: "deposit",
    amount: "2000.00",
    payee: "Paycheck",
    frequency: "monthly",
    anchorOn: plus(10),
    lines: [{ envelopeId: salary.id, amount: "2000.00" }],
  });
  return api;
}

describe("ForecastView (FEAT-013)", () => {
  test("projects scheduled events into a running-balance table with the headline summary", async () => {
    render(<ForecastView api={await seededScheduled()} />);
    await screen.findByRole("table");

    // Rent dips the balance below zero at +5; the paycheck recovers it at +10.
    const rent = within(rowByDate(plus(5)));
    expect(rent.getByText("Rent")).toBeTruthy();
    expect(rent.getByText("-$1,500.00")).toBeTruthy();
    expect(rent.getByText("-$500.00")).toBeTruthy();

    const pay = within(rowByDate(plus(10)));
    expect(pay.getByText("Paycheck")).toBeTruthy();
    expect(pay.getByText("+$2,000.00")).toBeTruthy();
    expect(pay.getByText("$1,500.00")).toBeTruthy();

    // The negative warning names the exact first-negative date.
    expect(screen.getByText(`⚠ on ${plus(5)}`)).toBeTruthy();
  });

  test("the expected-spend toggle folds targets in (default on) and off shows the flat scheduled-only floor", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "1000.00" });
    const groceries = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    await api.setEnvelopeTarget(groceries.id, "400.00"); // discretionary, not scheduled

    render(<ForecastView api={api} />);
    // Default ON: expected discretionary spend appears (no scheduled rules, so it's the only activity).
    await screen.findByRole("table");
    expect(screen.getAllByText("Expected discretionary spend").length).toBeGreaterThan(0);

    // Toggle OFF → scheduled-only, and with no rules that's a flat projection (no events).
    await userEvent.click(screen.getByLabelText("Include expected spend"));
    expect(await screen.findByText(/No upcoming activity/)).toBeTruthy();
  });

  test("empty state when there are no accounts", async () => {
    render(<ForecastView api={makeFakeApi()} />);
    expect(await screen.findByText(/Add an account first/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("surfaces a load error", async () => {
    const api = makeFakeApi({
      getCashFlowForecast: () => Promise.reject(new ApiError("Couldn't reach the server.")),
    });
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "0" });
    render(<ForecastView api={api} />);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Couldn't reach the server."),
    );
  });
});
