import { describe, expect, test } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { QuickAddTransaction } from "./QuickAddTransaction";
import { type Api, type CreateTransactionInput } from "./api";
import { makeFakeApi } from "./test/fakeApi";

/** Mount the modal route inside a memory router with a home sentinel, so "close returns to where
 *  you were" is observable. By default we ARRIVE at the modal from "/" (a real push → a real back
 *  entry); pass `deepLink` to render directly on the modal (the no-history fallback). */
function renderModal(api: Api, { deepLink = false }: { deepLink?: boolean } = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <div>
            <p>HOME SENTINEL</p>
            <Link to="/transactions/new">open quick add</Link>
          </div>
        ),
      },
      { path: "/transactions/new", element: <QuickAddTransaction api={api} /> },
      { path: "/accounts", element: <p>ACCOUNTS SENTINEL</p> },
    ],
    { initialEntries: deepLink ? ["/transactions/new"] : ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

/** Seed an account + envelope and wrap createTransaction so the test can inspect the call. */
async function seededApi() {
  const base = makeFakeApi();
  const account = await base.createAccount({
    name: "Checking",
    kind: "checking",
    startingBalance: "0.00",
  });
  const envelope = await base.createEnvelope({ name: "Groceries", kind: "standard" });
  const created: { accountId: string; input: CreateTransactionInput }[] = [];
  const api: Api = {
    ...base,
    async createTransaction(accountId, input) {
      created.push({ accountId, input });
      return base.createTransaction(accountId, input);
    },
  };
  return { api, base, account, envelope, created };
}

describe("QuickAddTransaction (UX7 — global quick-add modal)", () => {
  test("opens an accessible dialog with an account picker", async () => {
    const { api } = await seededApi();
    const user = userEvent.setup();
    renderModal(api);
    await user.click(await screen.findByRole("link", { name: "open quick add" }));

    const dialog = await screen.findByRole("dialog", { name: "Add a transaction" });
    expect(dialog).toBeTruthy();
    // The global entry (unlike the register) makes you choose the account.
    expect(await screen.findByRole("combobox", { name: "Account" })).toBeTruthy();
  });

  test("Save is held until an account is chosen", async () => {
    const { api, envelope } = await seededApi();
    const user = userEvent.setup();
    renderModal(api);
    await user.click(await screen.findByRole("link", { name: "open quick add" }));
    await screen.findByRole("dialog");

    await user.type(screen.getByRole("textbox", { name: "Transaction amount" }), "50.00");
    await user.selectOptions(screen.getByRole("combobox", { name: "Envelope" }), envelope.id);

    const save = screen.getByRole<HTMLButtonElement>("button", { name: "Save transaction" });
    expect(save.disabled).toBe(true); // no account yet

    await user.selectOptions(screen.getByRole("combobox", { name: "Account" }), "Checking");
    expect(save.disabled).toBe(false);
  });

  test("saving posts to the chosen account and returns to where you were", async () => {
    const { api, account, envelope, created } = await seededApi();
    const user = userEvent.setup();
    renderModal(api);
    await user.click(await screen.findByRole("link", { name: "open quick add" }));
    await screen.findByRole("dialog");

    await user.selectOptions(screen.getByRole("combobox", { name: "Account" }), "Checking");
    await user.type(screen.getByRole("textbox", { name: "Transaction amount" }), "50.00");
    await user.selectOptions(screen.getByRole("combobox", { name: "Envelope" }), envelope.id);
    await user.click(screen.getByRole("button", { name: "Save transaction" }));

    // It fanned out to the existing createTransaction with the picked account.
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]!.accountId).toBe(account.id);
    expect(created[0]!.input.allocations).toEqual([{ envelopeId: envelope.id, amount: "50.00" }]);

    // …and it returned us to where we were (the dialog is gone, home is back).
    expect(await screen.findByText("HOME SENTINEL")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a partial allocation's remainder still surfaces in needs-allocation", async () => {
    const { api, base, envelope } = await seededApi();
    const user = userEvent.setup();
    renderModal(api);
    await user.click(await screen.findByRole("link", { name: "open quick add" }));
    await screen.findByRole("dialog");

    await user.selectOptions(screen.getByRole("combobox", { name: "Account" }), "Checking");
    await user.type(screen.getByRole("textbox", { name: "Transaction amount" }), "100.00");
    // Split mode → allocate only 40 of the 100 (a partial allocation).
    await user.click(screen.getByRole("radio", { name: "Split" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Envelope for row 1" }),
      envelope.id,
    );
    await user.type(screen.getByRole("textbox", { name: "Amount for row 1" }), "40.00");
    await user.click(screen.getByRole("button", { name: "Save transaction" }));

    await screen.findByText("HOME SENTINEL");
    // The $60 remainder reconciles to the ledger and lands in needs-allocation (no forced full split).
    const needs = await base.listNeedsAllocation();
    expect(needs).toHaveLength(1);
    expect(Math.abs(needs[0]!.unallocatedCents)).toBe(6000);
  });

  test("ESC closes the modal and returns to where you were", async () => {
    const { api } = await seededApi();
    const user = userEvent.setup();
    renderModal(api);
    await user.click(await screen.findByRole("link", { name: "open quick add" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(await screen.findByText("HOME SENTINEL")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("with no accounts, it points you to add one instead of a dead form", async () => {
    const api = makeFakeApi(); // no accounts seeded
    renderModal(api, { deepLink: true });

    expect(await screen.findByRole("dialog", { name: "Add a transaction" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add an account" }).getAttribute("href")).toBe(
      "/accounts",
    );
    expect(screen.queryByRole("form", { name: "Add transaction" })).toBeNull();
  });
});
