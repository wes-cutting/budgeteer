import { describe, expect, test } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SpendingBreakdownView } from "./SpendingBreakdownView";
import { ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";

const row = (name: string): HTMLElement =>
  screen.getByRole("rowheader", { name }).closest("tr") as HTMLElement;

/** Switch the month and wait for the reloaded table (its caption names the month). */
async function showMonth(month: string) {
  fireEvent.change(screen.getByLabelText("Month"), { target: { value: month } });
  await screen.findByText(new RegExp(`Share of ${month} outflow`));
}

/**
 * March 2026 outflow: Groceries −360 (funded +500 first, excluded), Dining −150, Fun −45.
 * Total outflow $555 ⇒ shares Groceries 64.9%, Dining 27.0%, Fun 8.1%.
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
  await api.createTransaction(acct.id, {
    kind: "deposit",
    amount: "500.00",
    occurredOn: "2026-03-01",
    allocations: [{ envelopeId: groceries.id, amount: "500.00" }],
  });
  await api.createTransaction(acct.id, {
    kind: "withdrawal",
    amount: "360.00",
    occurredOn: "2026-03-20",
    allocations: [{ envelopeId: groceries.id, amount: "360.00" }],
  });
  await api.createTransaction(acct.id, {
    kind: "withdrawal",
    amount: "150.00",
    occurredOn: "2026-03-22",
    allocations: [{ envelopeId: dining.id, amount: "150.00" }],
  });
  await api.createTransaction(acct.id, {
    kind: "withdrawal",
    amount: "45.00",
    occurredOn: "2026-03-25",
    allocations: [{ envelopeId: fun.id, amount: "45.00" }],
  });
  return api;
}

describe("SpendingBreakdownView (FEAT-UX9)", () => {
  test("ranks envelopes by outflow share and totals 100%", async () => {
    render(<SpendingBreakdownView api={await seeded()} />);
    await showMonth("2026-03");

    // Each row carries its outflow and its share of the $555 total.
    expect(within(row("Groceries")).getByText("$360.00")).toBeTruthy();
    expect(within(row("Groceries")).getByText("64.9%")).toBeTruthy();
    expect(within(row("Dining")).getByText("27.0%")).toBeTruthy();
    expect(within(row("Fun")).getByText("8.1%")).toBeTruthy();

    // The footer carries the total outflow at 100%.
    const totals = within(row("Total"));
    expect(totals.getByText("$555.00")).toBeTruthy();
    expect(totals.getByText("100.0%")).toBeTruthy();

    // The chart is a role=img whose summary names the largest slice first (rank order = signal).
    const img = screen.getByRole("img", { name: /Spending breakdown for 2026-03/ });
    expect(img.getAttribute("aria-label")).toContain("Groceries 64.9%");

    // Funding is excluded: the $500 deposit never appears as outflow.
    expect(screen.queryByText("$500.00")).toBeNull();
  });

  test("rows are ordered largest share first", async () => {
    render(<SpendingBreakdownView api={await seeded()} />);
    await showMonth("2026-03");
    const names = screen
      .getAllByRole("rowheader")
      .map((th) => th.textContent)
      .filter((t) => t !== "Total");
    expect(names).toEqual(["Groceries", "Dining", "Fun"]);
  });

  test("empty state when the month has no outflow", async () => {
    render(<SpendingBreakdownView api={await seeded()} />);
    // The default month (today) has no spend in this fixture ⇒ the empty prompt, no table.
    expect(await screen.findByText(/No spending recorded/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("surfaces a load error", async () => {
    const api = makeFakeApi({
      getBudgetVsActual: () => Promise.reject(new ApiError("Couldn't reach the server.")),
    });
    render(<SpendingBreakdownView api={api} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't reach the server.");
  });
});
