import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppShell } from "./AppShell";
import { ApiProvider } from "./api-context";
import { type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";

function renderShell(api: Api = makeFakeApi()) {
  return render(
    <ApiProvider value={api}>
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    </ApiProvider>,
  );
}

describe("AppShell (UX3 — persistent nav)", () => {
  test("renders the primary navigation links", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const name of [
      "Add transaction",
      "Home",
      "Accounts",
      "Envelopes",
      "Templates",
      "Recurring",
      "Insights",
      "Manage",
      "Download backup",
    ]) {
      expect(within(nav).getByRole("link", { name })).toBeTruthy();
    }
    // UX7 — the global quick-add points at the modal route.
    expect(within(nav).getByRole("link", { name: "Add transaction" }).getAttribute("href")).toBe(
      "/transactions/new",
    );
    // The Home brand link is present too.
    expect(screen.getByRole("link", { name: "Budgeteer" })).toBeTruthy();
  });

  test("needs-allocation badge carries the count in the link's accessible name (R2)", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0.00",
    });
    // Three unallocated deposits → three transactions needing allocation household-wide.
    for (const amount of ["10.00", "20.00", "30.00"]) {
      await api.createTransaction(acct.id, {
        kind: "deposit",
        amount,
        payee: "x",
        allocations: [],
      });
    }

    renderShell(api);
    // The count is in the accessible NAME (not colour/visual only).
    expect(await screen.findByRole("link", { name: "Needs allocation (3)" })).toBeTruthy();
  });

  test("the badge is absent when nothing needs allocation (R2)", async () => {
    renderShell();
    // The plain link is present; no count in the accessible name.
    expect(await screen.findByRole("link", { name: "Needs allocation" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Needs allocation \(/ })).toBeNull();
  });
});
