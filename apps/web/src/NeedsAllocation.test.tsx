import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NeedsAllocation } from "./NeedsAllocation";
import { makeFakeApi } from "./test/fakeApi";

describe("NeedsAllocation (allocate-later)", () => {
  test("completing a partial transaction removes it from the list", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0",
    });
    const rent = await api.createEnvelope({ name: "Rent", kind: "standard" });
    await api.createTransaction(account.id, {
      kind: "deposit",
      amount: "1000.00",
      allocations: [],
    });

    const user = userEvent.setup();
    render(<NeedsAllocation api={api} onBack={() => {}} />);

    expect(await screen.findByText(/needs \$1,000\.00/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Allocate" }));
    await user.selectOptions(await screen.findByLabelText("Envelope"), rent.id);
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    expect(await screen.findByText(/Nothing to allocate/i)).toBeTruthy();
  });
});
