import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alert, Badge, Button, Dialog, EmptyState, Field, Input, Select, Skeleton } from "./index";

describe("ui primitives (FEAT-UX4)", () => {
  test("Button forwards aria-label + onClick and defaults to type=button", async () => {
    const onClick = vi.fn();
    render(<Button aria-label="Save split" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "Save split" });
    expect(btn.getAttribute("type")).toBe("button");
    await userEvent.setup().click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("Button honors an explicit type and disabled", () => {
    render(
      <Button type="submit" disabled>
        Go
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Go" }) as HTMLButtonElement;
    expect(btn.getAttribute("type")).toBe("submit");
    expect(btn.disabled).toBe(true);
  });

  test("Badge renders its text — color is never the sole signal", () => {
    render(<Badge tone="danger">needs $40.00</Badge>);
    expect(screen.getByText("needs $40.00")).toBeTruthy();
  });

  test("Alert exposes role=alert with its message", () => {
    render(<Alert>Couldn&apos;t save</Alert>);
    expect(screen.getByRole("alert").textContent).toContain("save");
  });

  test("EmptyState shows a title and a next action", () => {
    render(
      <EmptyState title="No transactions yet">
        <button type="button">Add one</button>
      </EmptyState>,
    );
    expect(screen.getByText("No transactions yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add one" })).toBeTruthy();
  });

  test("Skeleton announces a loading status and hides decorative bars from AT", () => {
    const { container } = render(<Skeleton rows={2} />);
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(2);
  });

  test("Field ties its label to the control; Input forwards native props", () => {
    render(
      <Field label="From date" htmlFor="from">
        <Input id="from" type="date" defaultValue="2026-06-01" />
      </Field>,
    );
    const input = screen.getByLabelText("From date") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-06-01");
  });

  test("Select forwards its value through the labelled field", () => {
    render(
      <Field label="Envelope" htmlFor="env">
        <Select id="env" defaultValue="e2">
          <option value="e1">Rent</option>
          <option value="e2">Groceries</option>
        </Select>
      </Field>,
    );
    expect((screen.getByLabelText("Envelope") as HTMLSelectElement).value).toBe("e2");
  });

  test("Dialog is a labelled, modal role=dialog and dismisses via ESC and the close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog title="Add a transaction" description="Pick an account." onClose={onClose}>
        <button type="button">Inside</button>
      </Dialog>,
    );
    // role=dialog + an accessible name wired from the title (Radix sets aria-labelledby).
    const dialog = screen.getByRole("dialog", { name: "Add a transaction" });
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
