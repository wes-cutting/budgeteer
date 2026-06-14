import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "./Dashboard";
import { type AccountView, type Api, ApiError, type EnvelopeView } from "./api";

/** An in-memory fake of the API, so the UI is tested without a server (UX spec acceptance). */
function fakeApi(overrides: Partial<Api> = {}): Api {
  const accounts: AccountView[] = [];
  const envelopes: EnvelopeView[] = [];
  let seq = 0;
  return {
    async listAccounts() {
      return [...accounts];
    },
    async listEnvelopes() {
      return [...envelopes];
    },
    async createAccount({ name, kind, startingBalance }) {
      const account: AccountView = {
        id: `a${seq++}`,
        name,
        kind,
        balanceCents: Math.round(Number(startingBalance) * 100),
        archivedAt: null,
      };
      accounts.push(account);
      return account;
    },
    async createEnvelope({ name, kind }) {
      const envelope: EnvelopeView = {
        id: `e${seq++}`,
        name,
        kind,
        balanceCents: 0,
        archivedAt: null,
      };
      envelopes.push(envelope);
      return envelope;
    },
    ...overrides,
  };
}

describe("Dashboard (Foundation UX)", () => {
  test("renders both empty states on first run", async () => {
    render(<Dashboard api={fakeApi()} />);
    expect(await screen.findByText(/No accounts yet/i)).toBeTruthy();
    expect(await screen.findByText(/No envelopes yet/i)).toBeTruthy();
  });

  test("adding an account shows it with its formatted balance", async () => {
    const user = userEvent.setup();
    render(<Dashboard api={fakeApi()} />);
    await screen.findByText(/No accounts yet/i);

    const form = screen.getByRole("form", { name: /add account/i });
    await user.type(within(form).getByLabelText(/Name/i), "Checking");
    const balance = within(form).getByLabelText(/Starting balance/i);
    await user.clear(balance);
    await user.type(balance, "2140.00");
    await user.click(within(form).getByRole("button", { name: /add account/i }));

    expect(await screen.findByText("Checking")).toBeTruthy();
    expect(await screen.findByText("$2,140.00")).toBeTruthy();
  });

  test("adding an envelope shows it at $0.00", async () => {
    const user = userEvent.setup();
    render(<Dashboard api={fakeApi()} />);
    await screen.findByText(/No envelopes yet/i);

    const form = screen.getByRole("form", { name: /add envelope/i });
    await user.type(within(form).getByLabelText(/Name/i), "Groceries");
    await user.click(within(form).getByRole("button", { name: /add envelope/i }));

    expect(await screen.findByText("Groceries")).toBeTruthy();
    expect(await screen.findByText("$0.00")).toBeTruthy();
  });

  test("a server error message is surfaced inline", async () => {
    const user = userEvent.setup();
    const api = fakeApi({
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
});
