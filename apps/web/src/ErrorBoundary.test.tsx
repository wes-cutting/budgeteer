import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./ErrorBoundary";

// A child that throws during render when `boom` is true — the only kind of error a React error
// boundary catches (render/lifecycle, NOT events or async).
function Thrower({ boom }: { boom: boolean }) {
  if (boom) throw new Error("kaboom");
  return <p>recovered child</p>;
}

describe("ErrorBoundary (R12)", () => {
  // React logs caught render errors to console.error; silence it so the suite output stays clean.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders its children unchanged when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>healthy content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("healthy content")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("renders an accessible fallback when a child throws on render (not a blank screen)", () => {
    render(
      <ErrorBoundary>
        <Thrower boom={true} />
      </ErrorBoundary>,
    );

    // Live-region alert + heading + a real recovery button (role/heading/button — WCAG 2.2 AA).
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByRole("heading", { name: "Something went wrong", level: 1 }),
    ).toBeTruthy();
    // Default recovery label is "Reload" (the top-level full-page recovery).
    expect(within(alert).getByRole("button", { name: "Reload" })).toBeTruthy();
    // The thrown child is not rendered.
    expect(screen.queryByText("recovered child")).toBeNull();
  });

  test("the recovery button clears the error, runs onReset, and re-renders the recovered child", async () => {
    const onReset = vi.fn();

    function Harness() {
      const [boom, setBoom] = useState(true);
      return (
        <ErrorBoundary
          resetLabel="Try again"
          onReset={() => {
            onReset();
            setBoom(false);
          }}
        >
          <Thrower boom={boom} />
        </ErrorBoundary>
      );
    }

    render(<Harness />);
    // Crashed first: fallback shown with the custom label.
    expect(screen.getByRole("alert")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    // onReset fired; the boundary cleared its error and re-rendered the now-healthy child.
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("recovered child")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
