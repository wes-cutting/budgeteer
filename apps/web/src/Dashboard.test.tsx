import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "./Dashboard";
import { ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";

describe("Dashboard (Foundation UX)", () => {
  test("renders both empty states on first run", async () => {
    render(<Dashboard api={makeFakeApi()} />);
    expect(await screen.findByText(/No accounts yet/i)).toBeTruthy();
    expect(await screen.findByText(/No envelopes yet/i)).toBeTruthy();
  });

  test("adding an account shows it with its formatted balance", async () => {
    const user = userEvent.setup();
    render(<Dashboard api={makeFakeApi()} />);
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
    render(<Dashboard api={makeFakeApi()} />);
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
    render(<Dashboard api={api} />);
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

    render(<Dashboard api={api} />);
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
    render(<Dashboard api={makeFakeApi()} />);
    await screen.findByText(/No accounts yet/i);
    expect(screen.queryByRole("table", { name: "Net worth summary" })).toBeNull();
  });

  test("archiving an envelope moves it to the Archived section (FEAT-006)", async () => {
    const api = makeFakeApi();
    await api.createEnvelope({ name: "Vacation", kind: "sinking_fund" });

    const user = userEvent.setup();
    render(<Dashboard api={api} />);
    await screen.findByText("Vacation");

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("button", { name: "Unarchive" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
  });
});
