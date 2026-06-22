import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalysisSection } from "./AnalysisSection";
import { makeFakeApi } from "./test/fakeApi";

const TAB_LABELS = ["Spend", "Budget", "Forecast", "Credit", "Payoff", "Net worth"];

describe("AnalysisSection (R3 — grouped analysis nav)", () => {
  test("defaults to the spend view and exposes all six tabs, with the active one marked current", async () => {
    render(<AnalysisSection api={makeFakeApi()} onBack={() => {}} />);

    // Default tab = spend.
    expect(
      await screen.findByRole("heading", { name: "Analysis — spend by envelope", level: 1 }),
    ).toBeTruthy();

    const nav = screen.getByRole("navigation", { name: "Analysis views" });
    for (const label of TAB_LABELS) {
      // testing-library: a string `name` is an exact, full accessible-name match.
      expect(within(nav).getByRole("button", { name: label })).toBeTruthy();
    }
    // aria-current marks the active tab (not color/visual only).
    expect(within(nav).getByRole("button", { name: "Spend" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(within(nav).getByRole("button", { name: "Budget" }).getAttribute("aria-current")).toBe(
      null,
    );
  });

  test("switching tabs swaps the active view in place (previous view unmounts; onBack not called)", async () => {
    const onBack = vi.fn();
    render(<AnalysisSection api={makeFakeApi()} onBack={onBack} />);
    await screen.findByRole("heading", { name: "Analysis — spend by envelope", level: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Net worth" }));
    expect(
      await screen.findByRole("heading", { name: "Analysis — net worth over time", level: 1 }),
    ).toBeTruthy();

    // Only the active view is mounted — the spend view is gone (its fetch only runs while shown).
    expect(
      screen.queryByRole("heading", { name: "Analysis — spend by envelope", level: 1 }),
    ).toBeNull();
    // Switching stays inside the section — it does not exit to the Dashboard.
    expect(onBack).not.toHaveBeenCalled();

    const nav = screen.getByRole("navigation", { name: "Analysis views" });
    expect(
      within(nav).getByRole("button", { name: "Net worth" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  test("the active view's ← Dashboard button exits the section via onBack", async () => {
    const onBack = vi.fn();
    render(<AnalysisSection api={makeFakeApi()} onBack={onBack} />);
    await screen.findByRole("heading", { name: "Analysis — spend by envelope", level: 1 });

    await userEvent.click(screen.getByRole("button", { name: "← Dashboard" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
