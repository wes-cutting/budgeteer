import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllocationEditor } from "./AllocationEditor";

const envelopes = [
  { id: "rent", name: "Rent" },
  { id: "gro", name: "Groceries" },
  { id: "sav", name: "Savings" },
];

const saveButton = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("AllocationEditor (split UX — SPIKE-01)", () => {
  test("single mode allocates the whole amount to one envelope", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AllocationEditor magnitudeCents={320000} envelopes={envelopes} onSave={onSave} />);
    await user.selectOptions(screen.getByLabelText("Envelope"), "rent");
    await user.click(saveButton());
    expect(onSave).toHaveBeenCalledWith([{ envelopeId: "rent", amount: "3200.00" }]);
  });

  test("split shows a live remaining and allows a partial save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AllocationEditor magnitudeCents={320000} envelopes={envelopes} onSave={onSave} />);
    await user.click(screen.getByLabelText("Split"));
    await user.selectOptions(screen.getByLabelText("Envelope for row 1"), "rent");
    await user.type(screen.getByLabelText("Amount for row 1"), "1400.00");
    await user.click(screen.getByRole("button", { name: "Add row" }));
    await user.selectOptions(screen.getByLabelText("Envelope for row 2"), "gro");
    await user.type(screen.getByLabelText("Amount for row 2"), "600.00");

    expect(screen.getByText(/Remaining \$1,200\.00/)).toBeTruthy();
    await user.click(saveButton());
    expect(onSave).toHaveBeenCalledWith([
      { envelopeId: "rent", amount: "1400.00" },
      { envelopeId: "gro", amount: "600.00" },
    ]);
  });

  test('"use remaining" fills a row exactly to zero remaining', async () => {
    const user = userEvent.setup();
    render(<AllocationEditor magnitudeCents={10000} envelopes={envelopes} onSave={vi.fn()} />);
    await user.click(screen.getByLabelText("Split"));
    await user.selectOptions(screen.getByLabelText("Envelope for row 1"), "rent");
    await user.click(screen.getByRole("button", { name: "use remaining" }));
    expect((screen.getByLabelText("Amount for row 1") as HTMLInputElement).value).toBe("100.00");
    expect(screen.getByText(/Remaining \$0\.00/)).toBeTruthy();
  });

  test("over-allocation disables save and shows a warning", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AllocationEditor magnitudeCents={10000} envelopes={envelopes} onSave={onSave} />);
    await user.click(screen.getByLabelText("Split"));
    await user.selectOptions(screen.getByLabelText("Envelope for row 1"), "rent");
    await user.type(screen.getByLabelText("Amount for row 1"), "150.00");
    expect(screen.getByText(/Over-allocated by \$50\.00/)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
});
