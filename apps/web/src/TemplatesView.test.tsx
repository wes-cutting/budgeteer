import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplatesView } from "./TemplatesView";
import { makeFakeApi } from "./test/fakeApi";

describe("TemplatesView", () => {
  test("create a template, see it listed, then delete it", async () => {
    const api = makeFakeApi();
    const rent = await api.createEnvelope({ name: "Rent", kind: "standard" });

    const user = userEvent.setup();
    render(<TemplatesView api={api} />);
    await screen.findByText(/No templates yet/i);

    const form = screen.getByRole("form", { name: "New template" });
    await user.type(within(form).getByLabelText("Template name"), "Paycheck");
    await user.selectOptions(within(form).getByLabelText("Template envelope 1"), rent.id);
    await user.type(within(form).getByLabelText("Template amount 1"), "1400.00");
    await user.click(within(form).getByRole("button", { name: "Save template" }));

    expect(await screen.findByText("Paycheck")).toBeTruthy();
    expect(await screen.findByText(/1 lines · \$1,400\.00/)).toBeTruthy();

    // UX12 — Delete is irreversible, so it confirms first; the removal runs on confirm.
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete template?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/No templates yet/i)).toBeTruthy();
  });

  test("cancelling the delete confirm keeps the template (UX12)", async () => {
    const api = makeFakeApi();
    const rent = await api.createEnvelope({ name: "Rent", kind: "standard" });

    const user = userEvent.setup();
    render(<TemplatesView api={api} />);
    await screen.findByText(/No templates yet/i);

    const form = screen.getByRole("form", { name: "New template" });
    await user.type(within(form).getByLabelText("Template name"), "Paycheck");
    await user.selectOptions(within(form).getByLabelText("Template envelope 1"), rent.id);
    await user.type(within(form).getByLabelText("Template amount 1"), "1400.00");
    await user.click(within(form).getByRole("button", { name: "Save template" }));
    await screen.findByText("Paycheck");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete template?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Paycheck")).toBeTruthy();
  });
});
