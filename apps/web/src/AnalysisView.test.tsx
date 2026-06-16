import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalysisView } from "./AnalysisView";
import { ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";

const row = (name: string): HTMLElement =>
  screen.getByRole("rowheader", { name }).closest("tr") as HTMLElement;

describe("AnalysisView (FEAT-011)", () => {
  async function seeded() {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    const groceries = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    const vacation = await api.createEnvelope({ name: "Vacation", kind: "standard" });
    // March: fund Groceries +500 & Vacation +200, then spend −560 from Groceries (net −60).
    await api.createTransaction(acct.id, {
      kind: "deposit",
      amount: "1000.00",
      occurredOn: "2026-03-15",
      allocations: [
        { envelopeId: groceries.id, amount: "500.00" },
        { envelopeId: vacation.id, amount: "200.00" },
      ],
    });
    await api.createTransaction(acct.id, {
      kind: "withdrawal",
      amount: "560.00",
      occurredOn: "2026-03-20",
      allocations: [{ envelopeId: groceries.id, amount: "560.00" }],
    });
    // April: fund Groceries +300.
    await api.createTransaction(acct.id, {
      kind: "deposit",
      amount: "300.00",
      occurredOn: "2026-04-15",
      allocations: [{ envelopeId: groceries.id, amount: "300.00" }],
    });
    await api.archiveEnvelope(vacation.id); // history must still show
    return api;
  }

  test("renders the monthly grid with signed cells, archived rows, and footed totals", async () => {
    render(<AnalysisView api={await seeded()} onBack={() => {}} />);

    await screen.findByRole("table");
    expect(screen.getByRole("columnheader", { name: "2026-03" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "2026-04" })).toBeTruthy();

    // Groceries: −60 (Mar), +300 (Apr), +240 total.
    const groc = within(row("Groceries"));
    expect(groc.getByText("-$60.00")).toBeTruthy();
    expect(groc.getByText("$300.00")).toBeTruthy();
    expect(groc.getByText("$240.00")).toBeTruthy();

    // Vacation is archived but its history (+200 in March) still shows.
    expect(screen.getByRole("rowheader", { name: "Vacation (archived)" })).toBeTruthy();

    // Totals footer: columns 140/300, grand 440.
    const totals = within(row("Total"));
    expect(totals.getByText("$140.00")).toBeTruthy();
    expect(totals.getByText("$300.00")).toBeTruthy();
    expect(totals.getByText("$440.00")).toBeTruthy();
  });

  test("the grain toggle re-aggregates monthly ⇄ annual", async () => {
    render(<AnalysisView api={await seeded()} onBack={() => {}} />);
    await screen.findByRole("table");

    await userEvent.click(screen.getByRole("radio", { name: "Annual" }));

    // Columns collapse to the year; the month columns are gone.
    expect(await screen.findByRole("columnheader", { name: "2026" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "2026-03" })).toBeNull();
    // Groceries' yearly net = −60 + 300 = +240 — appears in the single year cell and the row total.
    expect(within(row("Groceries")).getAllByText("$240.00")).toHaveLength(2);
  });

  test("empty state when there is nothing to analyze", async () => {
    render(<AnalysisView api={makeFakeApi()} onBack={() => {}} />);
    expect(await screen.findByText(/No spending to analyze yet/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("surfaces a load error", async () => {
    const api = makeFakeApi({
      getEnvelopeSpend: () => Promise.reject(new ApiError("Couldn't reach the server.")),
    });
    render(<AnalysisView api={api} onBack={() => {}} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't reach the server.");
  });
});
