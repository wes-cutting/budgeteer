import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { AnalysisSection } from "./AnalysisSection";
import { makeFakeApi } from "./test/fakeApi";

const TAB_LABELS = ["Spend", "Budget", "Forecast", "Credit", "Payoff", "Net worth"];

// UX3 — the Insights area is now URL-driven (`/insights/:view`). Render it inside a router at a
// given view so useParams resolves, with a `/` stub for the boundary's recovery target.
function renderAt(view: string, api = makeFakeApi()) {
  return render(
    <MemoryRouter initialEntries={[`/insights/${view}`]}>
      <Routes>
        <Route path="/insights/:view" element={<AnalysisSection api={api} />} />
        <Route path="/" element={<h1>Budgeteer</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AnalysisSection (UX3 — routed Insights nav)", () => {
  test("renders the requested view and exposes all six tabs as links, active one marked current", async () => {
    renderAt("spend");

    expect(
      await screen.findByRole("heading", { name: "Analysis — spend by envelope", level: 1 }),
    ).toBeTruthy();

    const nav = screen.getByRole("navigation", { name: "Analysis views" });
    for (const label of TAB_LABELS) {
      expect(within(nav).getByRole("link", { name: label })).toBeTruthy();
    }
    // aria-current marks the active tab (set by NavLink — not colour/visual only).
    expect(within(nav).getByRole("link", { name: "Spend" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Budget" }).getAttribute("aria-current")).toBe(
      null,
    );
  });

  test("clicking a tab navigates to that view and swaps the active page in place", async () => {
    renderAt("spend");
    await screen.findByRole("heading", { name: "Analysis — spend by envelope", level: 1 });

    await userEvent.click(screen.getByRole("link", { name: "Net worth" }));
    expect(
      await screen.findByRole("heading", { name: "Analysis — net worth over time", level: 1 }),
    ).toBeTruthy();

    // Only the active view is mounted — the spend view is gone (its fetch only runs while shown).
    expect(
      screen.queryByRole("heading", { name: "Analysis — spend by envelope", level: 1 }),
    ).toBeNull();

    const nav = screen.getByRole("navigation", { name: "Analysis views" });
    expect(within(nav).getByRole("link", { name: "Net worth" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  test("an unknown view falls back to the default (spend) view", async () => {
    renderAt("bogus");
    expect(
      await screen.findByRole("heading", { name: "Analysis — spend by envelope", level: 1 }),
    ).toBeTruthy();
  });
});
