import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AccountsList } from "./AccountsList";
import { type Api, ApiError } from "./api";
import { makeFakeApi } from "./test/fakeApi";
import { ToastProvider } from "./ui";

// AccountsList renders account names as React Router <Link>s → it needs a router in tests.
function renderAccounts(api: Api = makeFakeApi()) {
  return render(
    <MemoryRouter>
      <AccountsList api={api} />
    </MemoryRouter>,
  );
}

// UX12c — the success toast lives above the app in a ToastProvider; wrap the view so a wired call
// site's toast is assertable (without a provider it silently no-ops — see Toast.test.tsx).
function renderAccountsWithToast(api: Api = makeFakeApi()) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <AccountsList api={api} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

/** Reveal the progressive Add affordance, then return the now-mounted form. */
async function openAddForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add account" }));
  return screen.getByRole("form", { name: "Add account" });
}

describe("AccountsList (UX6 — /accounts)", () => {
  test("renders the empty state on first run", async () => {
    renderAccounts();
    expect(await screen.findByText(/No accounts yet/i)).toBeTruthy();
  });

  test("shows an accessible skeleton while the list loads (UX12b)", async () => {
    renderAccounts();
    // Before the async list resolves the loading state is the Skeleton primitive — a polite
    // role="status" announces "Loading…" to AT (not a bare, unannounced <p>).
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    await screen.findByText(/No accounts yet/i); // flush the pending resolution
  });

  test("the add form is progressive — hidden until the Add affordance is used", async () => {
    renderAccounts();
    await screen.findByText(/No accounts yet/i);
    // No form on the page until the user opts in.
    expect(screen.queryByRole("form", { name: "Add account" })).toBeNull();
  });

  test("adding an account shows it as a link with its formatted balance", async () => {
    const user = userEvent.setup();
    renderAccounts();
    await screen.findByText(/No accounts yet/i);

    const form = await openAddForm(user);
    await user.type(within(form).getByLabelText(/Name/i), "Checking");
    const balance = within(form).getByLabelText(/Starting balance/i);
    await user.clear(balance);
    await user.type(balance, "2140.00");
    await user.click(within(form).getByRole("button", { name: /add account/i }));

    const list = await screen.findByRole("list", { name: "Accounts list" });
    expect(within(list).getByRole("link", { name: "Checking" })).toBeTruthy();
    expect(within(list).getByText("$2,140.00")).toBeTruthy();
  });

  test("a server error message is surfaced inline", async () => {
    const user = userEvent.setup();
    const api = makeFakeApi({
      async createAccount() {
        throw new ApiError("An account with that name already exists.");
      },
    });
    renderAccounts(api);
    await screen.findByText(/No accounts yet/i);

    const form = await openAddForm(user);
    await user.type(within(form).getByLabelText(/Name/i), "Checking");
    await user.click(within(form).getByRole("button", { name: /add account/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/already exists/i);
  });

  test("inline validation (UX12d): an un-parseable starting balance shows a field error and blocks the create", async () => {
    const user = userEvent.setup();
    const api = makeFakeApi();
    renderAccounts(api);
    await screen.findByText(/No accounts yet/i);

    const form = await openAddForm(user);
    await user.type(within(form).getByLabelText(/Name/i), "Checking");
    const balance = within(form).getByLabelText(/Starting balance/i);
    await user.clear(balance);
    await user.type(balance, "12,00"); // not a valid amount
    await user.click(within(form).getByRole("button", { name: /add account/i }));

    // Field-level error, input marked invalid + described by it, and no account was created.
    const err = within(form).getByText("Enter an amount like 12.34.");
    expect(balance.getAttribute("aria-invalid")).toBe("true");
    expect(balance.getAttribute("aria-describedby")).toBe(err.id);
    expect(screen.queryByRole("link", { name: "Checking" })).toBeNull();

    // Correcting it clears the error live and lets the account through.
    await user.clear(balance);
    await user.type(balance, "2140.00");
    expect(within(form).queryByText("Enter an amount like 12.34.")).toBeNull();
    await user.click(within(form).getByRole("button", { name: /add account/i }));
    const list = await screen.findByRole("list", { name: "Accounts list" });
    expect(within(list).getByRole("link", { name: "Checking" })).toBeTruthy();
  });

  test("archiving an account confirms first, then moves it behind the Show archived toggle (R7, UX12)", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Old Card", kind: "credit", startingBalance: "0.00" });

    const user = userEvent.setup();
    renderAccounts(api);
    await screen.findByRole("link", { name: "Old Card" });

    // UX12 — confirm before archiving.
    await user.click(screen.getByRole("button", { name: "Archive Old Card" }));
    const dialog = await screen.findByRole("dialog", { name: "Archive account?" });
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    // The active list no longer carries the account…
    expect(await screen.findByRole("button", { name: "Show archived" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Old Card" })).toBeNull();

    // …revealing the archived section exposes the unarchive control.
    await user.click(screen.getByRole("button", { name: "Show archived" }));
    expect(await screen.findByRole("button", { name: "Unarchive Old Card" })).toBeTruthy();
  });

  test("creating an account fires a success toast (UX12c)", async () => {
    const user = userEvent.setup();
    renderAccountsWithToast();
    await screen.findByText(/No accounts yet/i);

    const form = await openAddForm(user);
    await user.type(within(form).getByLabelText(/Name/i), "Checking");
    await user.click(within(form).getByRole("button", { name: /add account/i }));

    expect((await screen.findAllByText("Account created")).length).toBeGreaterThanOrEqual(1);
  });

  test("archiving an account fires a success toast (UX12c)", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Old Card", kind: "credit", startingBalance: "0.00" });

    const user = userEvent.setup();
    renderAccountsWithToast(api);
    await screen.findByRole("link", { name: "Old Card" });

    await user.click(screen.getByRole("button", { name: "Archive Old Card" }));
    const dialog = await screen.findByRole("dialog", { name: "Archive account?" });
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    expect((await screen.findAllByText("Account archived")).length).toBeGreaterThanOrEqual(1);
  });

  test("cancelling the archive confirm leaves the account active (UX12)", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Old Card", kind: "credit", startingBalance: "0.00" });

    const user = userEvent.setup();
    renderAccounts(api);
    await screen.findByRole("link", { name: "Old Card" });

    await user.click(screen.getByRole("button", { name: "Archive Old Card" }));
    const dialog = await screen.findByRole("dialog", { name: "Archive account?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("link", { name: "Old Card" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show archived" })).toBeNull();
  });
});
