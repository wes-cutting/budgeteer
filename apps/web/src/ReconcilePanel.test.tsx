import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountRegister } from "./AccountRegister";
import { makeFakeApi } from "./test/fakeApi";

describe("ReconcilePanel (FEAT-010)", () => {
  test("shows the live difference, records a reconciliation, and surfaces last-reconciled", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "750.00",
    });

    const user = userEvent.setup();
    render(
      <AccountRegister
        api={api}
        accountId={account.id}
        accountName="Checking"
        onBack={() => {}}
        onOpenNeeds={() => {}}
      />,
    );

    const panel = (await screen.findByRole("form", { name: "Reconcile" })).closest(
      "section",
    ) as HTMLElement;
    expect(within(panel).getByText(/Budgeteer balance: \$750\.00/)).toBeTruthy();
    expect(within(panel).getByText(/Not yet reconciled/)).toBeTruthy();

    // Enter a bank balance $50 higher → live difference shown before recording.
    await user.type(within(panel).getByLabelText("Bank balance"), "800.00");
    expect(within(panel).getByText(/Difference: \$50\.00 \(bank − Budgeteer\)/)).toBeTruthy();

    await user.click(within(panel).getByRole("button", { name: "Record reconciliation" }));

    expect(await within(panel).findByText(/Recorded — off by \$50\.00/)).toBeTruthy();
    expect(
      await within(panel).findByText(/Last reconciled \$800\.00 on .* \(off by \$50\.00\)/),
    ).toBeTruthy();
  });

  test("a matching balance reconciles cleanly", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "200.00",
    });

    const user = userEvent.setup();
    render(
      <AccountRegister
        api={api}
        accountId={account.id}
        accountName="Checking"
        onBack={() => {}}
        onOpenNeeds={() => {}}
      />,
    );

    const panel = (await screen.findByRole("form", { name: "Reconcile" })).closest(
      "section",
    ) as HTMLElement;
    await user.type(within(panel).getByLabelText("Bank balance"), "200.00");
    expect(within(panel).getByText(/Matches your bank/)).toBeTruthy();
    await user.click(within(panel).getByRole("button", { name: "Record reconciliation" }));
    expect(await within(panel).findByText(/Reconciled — matches your bank/)).toBeTruthy();
  });
});
