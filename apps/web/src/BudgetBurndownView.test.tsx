import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BudgetBurndownView } from "./BudgetBurndownView";
import { ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";

// Pin "today" to mid-month so the elapsed-time pace is deterministic (15 of 30 days = 50% elapsed)
// and the view's default month resolves to the same (mocked) current month, 2026-06. Only Date is
// faked, so userEvent's real timers keep working.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const row = (name: string): HTMLElement =>
  screen.getByRole("rowheader", { name }).closest("tr") as HTMLElement;

/**
 * Two budgeted envelopes, spent in the (mocked) current month 2026-06:
 *  Groceries — target $100, spent $80 ⇒ 80% consumed vs. 50% elapsed ⇒ OVER PACE
 *  Dining    — target $200, spent $40 ⇒ 20% consumed vs. 50% elapsed ⇒ ON TRACK
 *  All       — target $300, spent $120 ⇒ 40% consumed vs. 50% elapsed ⇒ ON TRACK
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
  await api.setEnvelopeTarget(groceries.id, "100.00");
  await api.setEnvelopeTarget(dining.id, "200.00");
  const spend = (envelopeId: string, amount: string) =>
    api.createTransaction(acct.id, {
      kind: "withdrawal",
      amount,
      occurredOn: "2026-06-10",
      allocations: [{ envelopeId, amount }],
    });
  await spend(groceries.id, "80.00");
  await spend(dining.id, "40.00");
  return api;
}

describe("BudgetBurndownView (FEAT-UX11)", () => {
  test("household scope: pace vs. target, with per-envelope rows in the fallback table", async () => {
    render(<BudgetBurndownView api={await seeded()} />);

    // Default scope is the household aggregate: 40% consumed at 50% elapsed ⇒ on track.
    const img = await screen.findByRole("img", { name: /All budgeted envelopes/ });
    const summary = img.getAttribute("aria-label") ?? "";
    expect(summary).toContain("40.0% of the $300.00 budget spent ($120.00)");
    expect(summary).toContain("50.0% of 2026-06 elapsed — on track");
    expect(screen.getByText(/On track — you're spending at or below/)).toBeTruthy();

    // The data-table fallback carries each budgeted envelope's exact figures + a TEXT pace verdict.
    expect(within(row("Groceries")).getByText("80.0%")).toBeTruthy();
    expect(within(row("Groceries")).getByText("over pace")).toBeTruthy();
    expect(within(row("Dining")).getByText("20.0%")).toBeTruthy();
    expect(within(row("Dining")).getByText("on track")).toBeTruthy();
    // Aggregate footer row.
    expect(within(row("All budgeted envelopes")).getByText("40.0%")).toBeTruthy();
  });

  test("picking one envelope re-gauges to that budget (over pace)", async () => {
    render(<BudgetBurndownView api={await seeded()} />);
    await screen.findByRole("img", { name: /All budgeted envelopes/ });

    await userEvent.selectOptions(screen.getByLabelText("Scope"), "Groceries");

    const img = await screen.findByRole("img", { name: /Groceries: 80.0% of the \$100.00 budget/ });
    expect(img).toBeTruthy();
    expect(screen.getByText(/Over pace — you're spending faster/)).toBeTruthy();
  });

  test("empty state when no envelope has a target", async () => {
    const api = makeFakeApi();
    await api.createEnvelope({ name: "Untargeted", kind: "standard" });
    render(<BudgetBurndownView api={api} />);
    expect(await screen.findByText(/No budgets set for/)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    // No scope picker without any budget.
    expect(screen.queryByLabelText("Scope")).toBeNull();
  });

  test("changing the month resets the scope to the household aggregate", async () => {
    render(<BudgetBurndownView api={await seeded()} />);
    await screen.findByRole("img", { name: /All budgeted envelopes/ });
    await userEvent.selectOptions(screen.getByLabelText("Scope"), "Groceries");
    await screen.findByRole("img", { name: /Groceries:/ });

    // Prior month: targets carry (not month-scoped) but there's no spend ⇒ 0% consumed, on track.
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-05" } });
    const img = await screen.findByRole("img", { name: /All budgeted envelopes/ });
    expect(img.getAttribute("aria-label")).toContain("0.0% of the $300.00 budget");
    expect((screen.getByLabelText("Scope") as HTMLSelectElement).value).toBe("all");
  });

  test("surfaces a load error", async () => {
    const api = makeFakeApi({
      getBudgetVsActual: () => Promise.reject(new ApiError("Couldn't reach the server.")),
    });
    render(<BudgetBurndownView api={api} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't reach the server.");
  });
});
