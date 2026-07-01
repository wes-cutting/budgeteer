import { describe, expect, test } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpendingTrendsView } from "./SpendingTrendsView";
import { ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";

const row = (name: string): HTMLElement =>
  screen.getByRole("rowheader", { name }).closest("tr") as HTMLElement;

/** Set the end month and wait for the reloaded table (its caption names the window). */
async function showWindow(endMonth: string) {
  fireEvent.change(screen.getByLabelText("End month"), { target: { value: endMonth } });
  await screen.findByText(new RegExp(`–${endMonth}:`));
}

/**
 * Three months of outflow across three envelopes (Groceries, Dining, Fun):
 *  2026-01: Groceries 100, Dining 50
 *  2026-02: Groceries 200, Dining 80, Fun 20
 *  2026-03: Groceries 300, Fun 10
 * Window sums: Groceries 600, Dining 130, Fun 30 ⇒ top 2 by outflow = Groceries, Dining (Fun excluded).
 * Monthly totals: 150, 300, 310 — up overall.
 */
async function seeded() {
  const api = makeFakeApi();
  const acct = await api.createAccount({
    name: "Checking",
    kind: "checking",
    startingBalance: "0",
  });
  const groceries = await api.createEnvelope({ name: "Groceries", kind: "standard" });
  const dining = await api.createEnvelope({ name: "Dining", kind: "standard" });
  const fun = await api.createEnvelope({ name: "Fun", kind: "standard" });
  const spend = (envelopeId: string, amount: string, occurredOn: string) =>
    api.createTransaction(acct.id, {
      kind: "withdrawal",
      amount,
      occurredOn,
      allocations: [{ envelopeId, amount }],
    });
  await spend(groceries.id, "100.00", "2026-01-05");
  await spend(dining.id, "50.00", "2026-01-10");
  await spend(groceries.id, "200.00", "2026-02-05");
  await spend(dining.id, "80.00", "2026-02-10");
  await spend(fun.id, "20.00", "2026-02-15");
  await spend(groceries.id, "300.00", "2026-03-05");
  await spend(fun.id, "10.00", "2026-03-15");
  return api;
}

describe("SpendingTrendsView (FEAT-UX10)", () => {
  test("shows the total trend and the top-2 envelopes by outflow over the window, 0-filled", async () => {
    render(<SpendingTrendsView api={await seeded()} />);
    await showWindow("2026-03");
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    await screen.findByText(/2026-01–2026-03/);

    // Header names Total + the top-2 envelopes only — Fun (rank 3) is excluded.
    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["Month", "Total", "Groceries", "Dining"]);
    expect(screen.queryByRole("columnheader", { name: "Fun" })).toBeNull();

    // Each month row carries the total + per-envelope outflow, 0-filled where an envelope had none.
    expect(within(row("2026-01")).getByText("$150.00")).toBeTruthy(); // total
    expect(within(row("2026-01")).getByText("$100.00")).toBeTruthy(); // Groceries
    expect(within(row("2026-01")).getByText("$50.00")).toBeTruthy(); // Dining
    expect(within(row("2026-03")).getByText("$310.00")).toBeTruthy(); // total
    expect(within(row("2026-03")).getByText("$300.00")).toBeTruthy(); // Groceries
    expect(within(row("2026-03")).getByText("$0.00")).toBeTruthy(); // Dining, 0-filled

    // role=img summary states direction + the ranked top spenders (not colour-only).
    const img = screen.getByRole("img", { name: /Spending trend over 3 months/ });
    const label = img.getAttribute("aria-label") ?? "";
    expect(label).toContain("$150.00 to $310.00 (up)");
    expect(label).toContain("Top spenders: Groceries, Dining");
  });

  test("empty state when the window has no outflow", async () => {
    render(<SpendingTrendsView api={await seeded()} />);
    // Well outside the fixture's data — no table caption ever renders, so set directly.
    fireEvent.change(screen.getByLabelText("End month"), { target: { value: "2020-01" } });
    expect(await screen.findByText(/No outflow in the/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("surfaces a load error", async () => {
    const api = makeFakeApi({
      getBudgetVsActual: () => Promise.reject(new ApiError("Couldn't reach the server.")),
    });
    render(<SpendingTrendsView api={api} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't reach the server.");
  });
});
