import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NetWorthView } from "./NetWorthView";
import { ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";

const summaryRow = (name: string): HTMLElement =>
  within(screen.getByRole("table", { name: "Current totals" }))
    .getByRole("rowheader", { name })
    .closest("tr") as HTMLElement;
const trendRow = (period: string): HTMLElement =>
  within(screen.getByRole("table", { name: /Net worth over time/ }))
    .getByRole("rowheader", { name: period })
    .closest("tr") as HTMLElement;

describe("NetWorthView (FEAT-R9)", () => {
  // Accounts open at $0 (the opening row is a harmless 0-flow); all balances arrive via dated txns,
  // so the trend is deterministic regardless of the run month.
  async function seeded() {
    const api = makeFakeApi();
    const checking = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    const card = await api.createAccount({ name: "Visa", kind: "credit", startingBalance: "0" });
    await api.createTransaction(checking.id, {
      kind: "deposit",
      amount: "1000.00",
      occurredOn: "2026-01-15",
      allocations: [],
    }); // assets 1000 after Jan
    await api.createTransaction(card.id, {
      kind: "withdrawal",
      amount: "200.00",
      occurredOn: "2026-02-10",
      allocations: [],
    }); // owe 200 → net 800 after Feb
    await api.createTransaction(checking.id, {
      kind: "deposit",
      amount: "500.00",
      occurredOn: "2026-03-20",
      allocations: [],
    }); // assets 1500 → net 1300 after Mar
    return api;
  }

  test("renders current totals and a cumulative monthly trend (net = assets + liabilities)", async () => {
    render(<NetWorthView api={await seeded()} onBack={() => {}} />);
    await screen.findByRole("table", { name: "Current totals" });

    // Headline: assets 1500, liabilities −200 (signed), net 1300.
    expect(within(summaryRow("Assets")).getByText("$1,500.00")).toBeTruthy();
    expect(within(summaryRow("Liabilities")).getByText("-$200.00")).toBeTruthy();
    expect(within(summaryRow("Net worth")).getByText("$1,300.00")).toBeTruthy();

    // Trend cumulates: Jan net 1000 (assets & net both $1,000), Feb net 800, Mar net 1300.
    expect(within(trendRow("2026-01")).getAllByText("$1,000.00")).toHaveLength(2);
    expect(within(trendRow("2026-02")).getByText("$800.00")).toBeTruthy();
    expect(within(trendRow("2026-02")).getByText("-$200.00")).toBeTruthy();
    expect(within(trendRow("2026-03")).getByText("$1,300.00")).toBeTruthy();
  });

  test("the grain toggle re-aggregates monthly ⇄ annual", async () => {
    render(<NetWorthView api={await seeded()} onBack={() => {}} />);
    await screen.findByRole("table", { name: "Current totals" });

    await userEvent.click(screen.getByRole("radio", { name: "Annual" }));

    // Months collapse to a single 2026 year-end point at net 1300 ("2026" rowheader = trend only).
    expect(await screen.findByRole("rowheader", { name: "2026" })).toBeTruthy();
    expect(screen.queryByRole("rowheader", { name: "2026-01" })).toBeNull();
    expect(within(trendRow("2026")).getByText("$1,300.00")).toBeTruthy();
  });

  test("empty state when there is no account activity", async () => {
    render(<NetWorthView api={makeFakeApi()} onBack={() => {}} />);
    expect(await screen.findByText(/No account activity to analyze yet/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("surfaces a load error", async () => {
    const api = makeFakeApi({
      getNetWorth: () => Promise.reject(new ApiError("Couldn't reach the server.")),
    });
    render(<NetWorthView api={api} onBack={() => {}} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't reach the server.");
  });
});
