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

    expect(await screen.findByText("Checking")).toBeTruthy();
    expect(await screen.findByText("$2,140.00")).toBeTruthy();
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
});
