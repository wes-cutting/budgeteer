import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { EnvelopesList } from "./EnvelopesList";
import { type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";

// EnvelopesList renders envelope names as React Router <Link>s → it needs a router in tests.
function renderEnvelopes(api: Api = makeFakeApi()) {
  return render(
    <MemoryRouter>
      <EnvelopesList api={api} />
    </MemoryRouter>,
  );
}

describe("EnvelopesList (UX6 — /envelopes)", () => {
  test("renders the empty state on first run", async () => {
    renderEnvelopes();
    expect(await screen.findByText(/No envelopes yet/i)).toBeTruthy();
  });

  test("shows an accessible skeleton while the list loads (UX12b)", async () => {
    renderEnvelopes();
    // Before the async list resolves the loading state is the Skeleton primitive — a polite
    // role="status" announces "Loading…" to AT (not a bare, unannounced <p>).
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    await screen.findByText(/No envelopes yet/i); // flush the pending resolution
  });

  test("the add form is progressive — hidden until the Add affordance is used", async () => {
    renderEnvelopes();
    await screen.findByText(/No envelopes yet/i);
    expect(screen.queryByRole("form", { name: "Add envelope" })).toBeNull();
  });

  test("adding an envelope shows it as a link at $0.00", async () => {
    const user = userEvent.setup();
    renderEnvelopes();
    await screen.findByText(/No envelopes yet/i);

    await user.click(screen.getByRole("button", { name: "Add envelope" }));
    const form = screen.getByRole("form", { name: "Add envelope" });
    await user.type(within(form).getByLabelText(/Name/i), "Groceries");
    await user.click(within(form).getByRole("button", { name: /add envelope/i }));

    const list = await screen.findByRole("table", { name: "Envelopes" });
    expect(within(list).getByRole("link", { name: "Groceries" })).toBeTruthy();
    expect(within(list).getByText("$0.00")).toBeTruthy();
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

    renderEnvelopes(api);
    // UXR3 — Target/Spent/Remaining are now their own table columns; the figures come from a
    // separate async fetch, so wait for the Groceries row to carry them.
    const list = await screen.findByRole("table", { name: "Envelopes" });
    const row = await within(list).findByRole("row", { name: /Groceries/ });
    expect(within(row).getByText("$200.00")).toBeTruthy(); // Target
    expect(within(row).getByText("$40.00")).toBeTruthy(); // Spent
    expect(within(row).getByText("$160.00")).toBeTruthy(); // Remaining
  });

  test("an envelope with no target shows em-dashes for its budget figures (R5)", async () => {
    const api = makeFakeApi();
    const budgeted = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    await api.setEnvelopeTarget(budgeted.id, "100.00");
    await api.createEnvelope({ name: "Fun", kind: "standard" });

    renderEnvelopes(api);
    const list = await screen.findByRole("table", { name: "Envelopes" });
    // Wait until the (independent) budget fetch has populated the budgeted row…
    const budgetedRow = await within(list).findByRole("row", { name: /Groceries/ });
    // A targeted row carries its figures (Target $100.00) and no em-dash placeholders.
    expect(within(budgetedRow).getAllByText("$100.00").length).toBeGreaterThanOrEqual(1);
    expect(within(budgetedRow).queryByText("—")).toBeNull();
    // …the untargeted "Fun" row shows "—" in Target/Spent/Remaining (no faked $0).
    const funRow = within(list).getByRole("row", { name: /Fun/ });
    expect(within(funRow).getAllByText("—")).toHaveLength(3);
  });

  test("archiving an envelope confirms first, then moves it to the Archived section (FEAT-006, UX12)", async () => {
    const api = makeFakeApi();
    await api.createEnvelope({ name: "Vacation", kind: "sinking_fund" });

    const user = userEvent.setup();
    renderEnvelopes(api);
    await screen.findByRole("link", { name: "Vacation" });

    // UX12 — the row control opens a confirm dialog; the archive runs only on confirm.
    await user.click(screen.getByRole("button", { name: "Archive Vacation" }));
    const dialog = await screen.findByRole("dialog", { name: "Archive envelope?" });
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    expect(await screen.findByRole("button", { name: "Unarchive Vacation" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Archive Vacation" })).toBeNull();
  });

  test("cancelling the archive confirm leaves the envelope active (UX12)", async () => {
    const api = makeFakeApi();
    await api.createEnvelope({ name: "Vacation", kind: "sinking_fund" });

    const user = userEvent.setup();
    renderEnvelopes(api);
    await screen.findByRole("link", { name: "Vacation" });

    await user.click(screen.getByRole("button", { name: "Archive Vacation" }));
    const dialog = await screen.findByRole("dialog", { name: "Archive envelope?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Archive Vacation" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unarchive Vacation" })).toBeNull();
  });
});
