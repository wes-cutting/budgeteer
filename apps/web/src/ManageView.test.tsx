import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ManageView } from "./ManageView";
import { type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";

// ManageView links to /accounts · /envelopes (React Router <Link>s) → it needs a router in tests.
function renderManage(api: Api = makeFakeApi()) {
  return render(
    <MemoryRouter>
      <ManageView api={api} />
    </MemoryRouter>,
  );
}

describe("ManageView (UX6 — /manage hub)", () => {
  test("links to the per-entity management list routes", async () => {
    renderManage();
    const manageNav = await screen.findByRole("navigation", { name: "Management" });
    expect(within(manageNav).getByRole("link", { name: "Accounts" }).getAttribute("href")).toBe(
      "/accounts",
    );
    expect(within(manageNav).getByRole("link", { name: "Envelopes" }).getAttribute("href")).toBe(
      "/envelopes",
    );
  });

  test("net worth summary sums accounts by kind (R4)", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "1000.00" });
    await api.createAccount({ name: "Savings", kind: "savings", startingBalance: "500.00" });
    await api.createAccount({ name: "Card", kind: "credit", startingBalance: "-300.00" });

    renderManage(api);
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

  test("net worth summary is replaced by a prompt until there is an account (R4)", async () => {
    renderManage();
    expect(await screen.findByText(/Add an account to total your assets/i)).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Net worth summary" })).toBeNull();
  });

  test("Move-money is available once there are two envelopes to move between", async () => {
    const api = makeFakeApi();
    await api.createEnvelope({ name: "Groceries", kind: "standard" });
    await api.createEnvelope({ name: "Vacation", kind: "sinking_fund" });

    renderManage(api);
    expect(await screen.findByRole("form", { name: "Move money between envelopes" })).toBeTruthy();
  });
});
