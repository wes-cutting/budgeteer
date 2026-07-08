import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./index";

/** A tiny harness: a button that fires a toast so we can drive the provider from a click. */
function ToastHarness({ message = "Saved" }: { message?: string }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(message)}>
      fire
    </button>
  );
}

describe("Toast primitive (FEAT-UX12c · ADR-0005)", () => {
  test("showToast surfaces a polite status message (role=status, NEVER role=alert)", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness message="Account created" />
      </ToastProvider>,
    );
    expect(screen.queryByText("Account created")).toBeNull();

    await user.click(screen.getByRole("button", { name: "fire" }));

    // The message is visible in the toast and mirrored into Radix's live region.
    expect((await screen.findAllByText("Account created")).length).toBeGreaterThanOrEqual(1);
    // That live region is a POLITE role="status" — a routine success confirmation announces without
    // interrupting the screen-reader user (never role="alert"/assertive).
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("the Dismiss affordance removes the toast", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness message="Transfer complete" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "fire" }));
    expect((await screen.findAllByText("Transfer complete")).length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryAllByText("Transfer complete")).toHaveLength(0);
  });

  test("without a provider, showToast is a silent no-op (auxiliary — degrades, never throws)", async () => {
    const user = userEvent.setup();
    // No <ToastProvider> in the tree.
    render(<ToastHarness message="Envelope created" />);
    await user.click(screen.getByRole("button", { name: "fire" }));
    expect(screen.queryByText("Envelope created")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
