import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Dashboard } from "./Dashboard";
import { type Api, ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";

// The Dashboard now renders the UX5 Cockpit, which uses React Router <Link>s — so it needs a
// router in tests. (The Cockpit's own panels are covered in Cockpit.test.tsx.)
function renderDashboard(api: Api = makeFakeApi()) {
  return render(
    <MemoryRouter>
      <Dashboard api={api} />
    </MemoryRouter>,
  );
}

describe("Dashboard (Foundation UX)", () => {
  test("renders both empty states on first run", async () => {
    renderDashboard();
    expect(await screen.findByText(/No accounts yet/i)).toBeTruthy();
    expect(await screen.findByText(/No envelopes yet/i)).toBeTruthy();
  });

  test("adding an account shows it with its formatted balance", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText(/No accounts yet/i);

    const form = screen.getByRole("form", { name: /add account/i });
    await user.type(within(form).getByLabelText(/Name/i), "Checking");
    const balance = within(form).getByLabelText(/Starting balance/i);
    await user.clear(balance);
    await user.type(balance, "2140.00");
    await user.click(within(form).getByRole("button", { name: /add account/i }));

    // Scope to the account row — the new net worth summary (R4) also shows $2,140.00.
    const list = await screen.findByRole("list", { name: "Accounts list" });
    expect(within(list).getByText("Checking")).toBeTruthy();
    expect(within(list).getByText("$2,140.00")).toBeTruthy();
  });

  test("adding an envelope shows it at $0.00", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText(/No envelopes yet/i);

    const form = screen.getByRole("form", { name: /add envelope/i });
    await user.type(within(form).getByLabelText(/Name/i), "Groceries");
    await user.click(within(form).getByRole("button", { name: /add envelope/i }));

    expect(await screen.findByText("Groceries")).toBeTruthy();
    expect(await screen.findByText("$0.00")).toBeTruthy();
  });

  test("a server error message is surfaced inline", async () => {
    const user = userEvent.setup();
    const api = makeFakeApi({
      async createAccount() {
        throw new ApiError("An account with that name already exists.");
      },
    });
    renderDashboard(api);
    await screen.findByText(/No accounts yet/i);

    const form = screen.getByRole("form", { name: /add account/i });
    await user.type(within(form).getByLabelText(/Name/i), "Checking");
    await user.click(within(form).getByRole("button", { name: /add account/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/already exists/i);
  });

  test("net worth summary sums accounts by kind (R4)", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "1000.00" });
    await api.createAccount({ name: "Savings", kind: "savings", startingBalance: "500.00" });
    await api.createAccount({ name: "Card", kind: "credit", startingBalance: "-300.00" });

    renderDashboard(api);
    const summary = await screen.findByRole("table", { name: "Net worth summary" });

    // Assets = $1,000 + $500 = $1,500; liabilities = −$300 (credit, kept negative).
    const assetsRow = within(summary).getByRole("row", { name: /Total assets/ });
    expect(within(assetsRow).getByRole("cell").textContent).toBe("$1,500.00");
    const liabilitiesRow = within(summary).getByRole("row", { name: /Total liabilities/ });
    expect(within(liabilitiesRow).getByRole("cell").textContent).toBe("-$300.00");
    // Net = assets + liabilities = $1,500 − $300 = $1,200 (agrees with the NetWorthView convention).
    const netRow = within(summary).getByRole("row", { name: /Net worth/ });
    expect(within(netRow).getByRole("cell").textContent).toBe("$1,200.00");
  });

  test("net worth summary is hidden until there is an account (R4)", async () => {
    renderDashboard();
    await screen.findByText(/No accounts yet/i);
    expect(screen.queryByRole("table", { name: "Net worth summary" })).toBeNull();
  });

  test("active envelope row shows its inline monthly target, spent, and remaining (R5)", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0.00",
    });
    const env = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    await api.setEnvelopeTarget(env.id, "200.00");
    // A withdrawal this month allocated to the envelope → spent $40.00, remaining $160.00.
    await api.createTransaction(acct.id, {
      kind: "withdrawal",
      amount: "40.00",
      payee: "Store",
      allocations: [{ envelopeId: env.id, amount: "40.00" }],
    });

    renderDashboard(api);
    // The inline figures come from a separate async fetch — wait for them to land.
    expect(await screen.findByText(/Target: \$200\.00/)).toBeTruthy();
    expect(screen.getByText(/Spent: \$40\.00/)).toBeTruthy();
    expect(screen.getByText(/Remaining: \$160\.00/)).toBeTruthy();
  });

  test("an envelope with no target shows no inline budget figures (R5)", async () => {
    const api = makeFakeApi();
    const budgeted = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    await api.setEnvelopeTarget(budgeted.id, "100.00");
    await api.createEnvelope({ name: "Fun", kind: "standard" });

    renderDashboard(api);
    const list = await screen.findByRole("list", { name: "Envelopes list" });
    // Wait until the (independent) budget fetch has populated the budgeted row…
    await within(list).findByText(/Target: \$100\.00/);
    // …then exactly one row shows a target — "Fun" gets no faked $0 target.
    expect(within(list).getAllByText(/Target:/)).toHaveLength(1);
  });

  test("archiving an envelope moves it to the Archived section (FEAT-006)", async () => {
    const api = makeFakeApi();
    await api.createEnvelope({ name: "Vacation", kind: "sinking_fund" });

    const user = userEvent.setup();
    renderDashboard(api);
    await screen.findByText("Vacation");

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("button", { name: "Unarchive" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
  });
});
