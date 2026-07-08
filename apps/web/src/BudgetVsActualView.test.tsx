import { describe, expect, test } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BudgetVsActualView } from "./BudgetVsActualView";
import { ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";
import styles from "./Insights.module.css";

const row = (name: string): HTMLElement =>
  screen.getByRole("rowheader", { name }).closest("tr") as HTMLElement;

/** Switch the month and wait for the reloaded table (its caption names the month). */
async function showMonth(month: string) {
  fireEvent.change(screen.getByLabelText("Month"), { target: { value: month } });
  await screen.findByText(new RegExp(`for ${month}`));
}

/**
 * March 2026: Groceries budget $400 (funded +500, spent −360 ⇒ funding excluded), Dining budget
 * $100 (spent −150 ⇒ over), Fun no budget (spent −45).
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
  await api.setEnvelopeTarget(groceries.id, "400.00");
  await api.setEnvelopeTarget(dining.id, "100.00");
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

describe("BudgetVsActualView (FEAT-012)", () => {
  test("shows an accessible skeleton while the report loads (UX12b)", async () => {
    render(<BudgetVsActualView api={makeFakeApi()} />);
    // The initial loading state is the Skeleton primitive — role="status" announces "Loading…".
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    await screen.findByText(/No envelopes to budget yet/i); // flush the pending resolution
  });

  test("shows target vs. outflow spend and remaining for the chosen month", async () => {
    render(<BudgetVsActualView api={await seeded()} />);
    await screen.findByRole("table");
    await showMonth("2026-03");

    // Groceries: target prefilled 400.00, spent 360 (funding excluded), remaining +40.
    const groc = within(row("Groceries"));
    expect((groc.getByLabelText("Monthly target for Groceries") as HTMLInputElement).value).toBe(
      "400.00",
    );
    expect(groc.getByText("$360.00")).toBeTruthy();
    expect(groc.getByText("$40.00")).toBeTruthy();

    // Dining: over budget ⇒ negative remaining shown as text.
    expect(within(row("Dining")).getByText("-$50.00")).toBeTruthy();

    // Fun: no target ⇒ empty input, but its spend is still shown; with no target both the Remaining
    // and the UX13 Spent-of-target cells show an em-dash (nothing to measure against).
    const fun = within(row("Fun"));
    expect((fun.getByLabelText("Monthly target for Fun") as HTMLInputElement).value).toBe("");
    expect(fun.getByText("$45.00")).toBeTruthy();
    expect(fun.getAllByText("—")).toHaveLength(2);

    // Totals footer: targets 500, spent 555, remaining (budgeted only) −10.
    const totals = within(row("Total"));
    expect(totals.getByText("$500.00")).toBeTruthy();
    expect(totals.getByText("$555.00")).toBeTruthy();
    expect(totals.getByText("-$10.00")).toBeTruthy();
  });

  test("encodes budget health: a per-row spent-of-target bar, over-budget remaining weighted (UX13)", async () => {
    render(<BudgetVsActualView api={await seeded()} />);
    await screen.findByRole("table");
    await showMonth("2026-03");

    // Groceries (budgeted) carries a decorative spent-of-target progress bar in its row.
    expect(row("Groceries").querySelector('[aria-hidden="true"]')).toBeTruthy();
    // Fun (no target) shows an em-dash instead of a bar.
    expect(row("Fun").querySelector('[aria-hidden="true"]')).toBeNull();

    // Over-budget remaining gets weight + danger tone; the minus sign stays the non-colour signal.
    const diningOver = within(row("Dining")).getByText("-$50.00");
    expect(diningOver.className).toContain(styles.overText);
    // The totals footer is over too (−$10.00) and is likewise weighted.
    expect(within(row("Total")).getByText("-$10.00").className).toContain(styles.overText);
    // An under-budget remaining is NOT flagged.
    expect(within(row("Groceries")).getByText("$40.00").className).not.toContain(styles.overText);
  });

  test("setting a target inline updates the remaining", async () => {
    render(<BudgetVsActualView api={await seeded()} />);
    await screen.findByRole("table");
    await showMonth("2026-03");

    const input = within(row("Fun")).getByLabelText("Monthly target for Fun");
    await userEvent.type(input, "50.00");
    await userEvent.click(within(row("Fun")).getByRole("button", { name: "Save" }));

    // Remaining = 50 − 45 = $5.00 once the report reloads (unique value in this dataset).
    expect(await screen.findByText("$5.00")).toBeTruthy();
  });

  test("clearing a target removes it (remaining → em-dash, no Clear button)", async () => {
    render(<BudgetVsActualView api={await seeded()} />);
    await screen.findByRole("table");
    await showMonth("2026-03");

    await userEvent.click(within(row("Dining")).getByRole("button", { name: "Clear" }));

    // After reload Dining has no target: its Clear button is gone and the input is empty.
    await waitFor(() =>
      expect(within(row("Dining")).queryByRole("button", { name: "Clear" })).toBeNull(),
    );
    expect(
      (within(row("Dining")).getByLabelText("Monthly target for Dining") as HTMLInputElement).value,
    ).toBe("");
  });

  test("empty state when there are no envelopes to budget", async () => {
    render(<BudgetVsActualView api={makeFakeApi()} />);
    expect(await screen.findByText(/No envelopes to budget yet/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("surfaces a load error", async () => {
    const api = makeFakeApi({
      getBudgetVsActual: () => Promise.reject(new ApiError("Couldn't reach the server.")),
    });
    render(<BudgetVsActualView api={api} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't reach the server.");
  });
});
