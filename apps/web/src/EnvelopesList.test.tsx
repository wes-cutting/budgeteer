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

    const list = await screen.findByRole("list", { name: "Envelopes list" });
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

    renderEnvelopes(api);
    const list = await screen.findByRole("list", { name: "Envelopes list" });
    // Wait until the (independent) budget fetch has populated the budgeted row…
    await within(list).findByText(/Target: \$100\.00/);
    // …then exactly one row shows a target — "Fun" gets no faked $0 target.
    expect(within(list).getAllByText(/Target:/)).toHaveLength(1);
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
